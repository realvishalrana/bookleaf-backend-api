import { Router, Request, Response, NextFunction } from "express";
import { Role } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { authenticate, requireRole } from "../middleware/auth";
import { validateBody, validateQuery } from "../middleware/validate";
import { uploadSingle } from "../middleware/upload";
import { triageTicket } from "../services/ai/classifier";
import { findDuplicates } from "../services/ai/duplicates";
import {
  effectiveCategory,
  effectivePriority,
  CATEGORY_LABELS,
} from "../utils/ticket";
import { paramId } from "../utils/params";

const router = Router();
router.use(authenticate, requireRole(Role.AUTHOR));

function formatBook(b: {
  id: string;
  title: string;
  isbn: string | null;
  genre: string | null;
  publicationDate: Date | null;
  status: string;
  mrp: number | null;
  totalCopiesSold: number;
  totalRoyaltyEarned: unknown;
  royaltyPaid: unknown;
  royaltyPending: unknown;
}) {
  return {
    bookId: b.id,
    title: b.title,
    isbn: b.isbn,
    genre: b.genre,
    publicationDate: b.publicationDate,
    status: b.status,
    mrp: b.mrp,
    totalCopiesSold: b.totalCopiesSold,
    totalRoyaltyEarned: Number(b.totalRoyaltyEarned),
    royaltyPaid: Number(b.royaltyPaid),
    royaltyPending: Number(b.royaltyPending),
  };
}

/**
 * @openapi
 * /api/v1/author/books:
 *   get:
 *     tags: [Author]
 *     summary: List books for the logged-in author
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Author's books with royalty fields
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Not an author
 */
router.get("/books", async (req, res, next) => {
  try {
    const books = await prisma.book.findMany({
      where: { authorId: req.user!.authorId! },
      orderBy: { title: "asc" },
    });
    res.json({ books: books.map(formatBook) });
  } catch (e) {
    next(e);
  }
});

/**
 * @openapi
 * /api/v1/author/tickets:
 *   get:
 *     tags: [Author]
 *     summary: List support tickets for the logged-in author
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Ticket list with status, category, priority
 *       401:
 *         description: Unauthorized
 */
const ticketListQuerySchema = z.object({
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

router.get("/tickets", validateQuery(ticketListQuerySchema), async (req, res, next) => {
  try {
    const q = req.query as unknown as z.infer<typeof ticketListQuerySchema>;
    const where = {
      authorId: req.user!.authorId!,
      ...(q.search ? { subject: { contains: q.search } } : {}),
    };

    const [total, tickets] = await Promise.all([
      prisma.ticket.count({ where }),
      prisma.ticket.findMany({
        where,
        include: {
          book: { select: { id: true, title: true } },
          messages: { orderBy: { createdAt: "asc" as const }, take: 1 },
        },
        orderBy: { createdAt: "desc" as const },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
    ]);

    res.json({
      tickets: tickets.map((t) => ({
        id: t.id,
        subject: t.subject,
        status: t.status,
        category: effectiveCategory(t),
        categoryLabel: effectiveCategory(t)
          ? CATEGORY_LABELS[effectiveCategory(t)!]
          : null,
        priority: effectivePriority(t),
        book: t.book,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
      })),
      total,
      page: q.page,
      totalPages: Math.max(1, Math.ceil(total / q.limit)),
    });
  } catch (e) {
    next(e);
  }
});

const createTicketBodySchema = z.object({
  bookId: z.string().nullable().optional(),
  subject: z.string().min(3).max(200),
  description: z.string().min(10).max(5000),
});

/**
 * @openapi
 * /api/v1/author/tickets:
 *   post:
 *     tags: [Author]
 *     summary: Create a support ticket (triggers AI classify + priority)
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [subject, description]
 *             properties:
 *               bookId: { type: string, nullable: true }
 *               subject: { type: string, minLength: 3 }
 *               description: { type: string, minLength: 10 }
 *               attachment: { type: string, format: binary, description: Optional image (jpeg/png/gif/webp, max 5MB) }
 *     responses:
 *       201:
 *         description: Ticket created
 *       400:
 *         description: Validation error or invalid book
 */
router.post(
  "/tickets",
  (req: Request, res: Response, next: NextFunction) => {
    uploadSingle(req, res, (err) => {
      if (err) {
        res.status(400).json({ error: err.message });
        return;
      }
      next();
    });
  },
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = createTicketBodySchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.flatten().fieldErrors });
        return;
      }

      const authorId = req.user!.authorId!;
      const { bookId, subject, description } = parsed.data;
      const attachmentUrl = req.file ? `/uploads/${req.file.filename}` : undefined;
      const attachmentName = req.file ? req.file.originalname : undefined;

      if (bookId) {
        const book = await prisma.book.findFirst({
          where: { id: bookId, authorId },
        });
        if (!book) {
          res.status(400).json({ error: "Invalid book for this author" });
          return;
        }
      }

      const ticket = await prisma.ticket.create({
        data: {
          authorId,
          bookId: bookId ?? null,
          subject,
          description,
          attachmentName,
          attachmentUrl,
        },
        include: { book: { select: { title: true } } },
      });

      const { result: triage, error: triageError } = await triageTicket(
        subject,
        description
      );
      const updated = await prisma.ticket.update({
        where: { id: ticket.id },
        data: triage
          ? {
              aiCategory: triage.category,
              aiPriority: triage.priority,
              aiLastError: null,
            }
          : {
              aiLastError: triageError ?? "AI classification unavailable",
            },
        include: { book: { select: { id: true, title: true } } },
      });

      // Duplicate detection — runs async, non-blocking; failures are silent
      (async () => {
        try {
          const openTickets = await prisma.ticket.findMany({
            where: { status: { in: ["OPEN", "IN_PROGRESS"] }, id: { not: ticket.id } },
            select: { id: true, subject: true, description: true },
          });
          const { similarIds } = await findDuplicates(subject, description, openTickets);
          if (similarIds.length > 0) {
            await prisma.ticket.update({
              where: { id: ticket.id },
              data: { aiSimilarTicketIds: similarIds.join(",") },
            });
          }
        } catch {
          // Non-critical — do not fail the request
        }
      })();

      res.status(201).json({
        ticket: {
          id: updated.id,
          subject: updated.subject,
          status: updated.status,
          category: effectiveCategory(updated),
          priority: effectivePriority(updated),
          attachmentUrl: updated.attachmentUrl,
          book: updated.book,
          createdAt: updated.createdAt,
        },
      });
    } catch (e) {
      next(e);
    }
  }
);

/**
 * @openapi
 * /api/v1/author/tickets/{id}:
 *   get:
 *     tags: [Author]
 *     summary: Get ticket detail with public messages (own tickets only)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Ticket with messages (no internal notes)
 *       404:
 *         description: Ticket not found
 */
router.get("/tickets/:id", async (req, res, next) => {
  try {
    const ticket = await prisma.ticket.findFirst({
      where: { id: paramId(req), authorId: req.user!.authorId! },
      include: {
        book: { select: { id: true, title: true, status: true } },
        messages: {
          orderBy: { createdAt: "asc" },
          include: { sender: { select: { name: true, role: true } } },
        },
      },
    });

    if (!ticket) {
      res.status(404).json({ error: "Ticket not found" });
      return;
    }

    res.json({
      ticket: {
        id: ticket.id,
        subject: ticket.subject,
        description: ticket.description,
        status: ticket.status,
        category: effectiveCategory(ticket),
        categoryLabel: effectiveCategory(ticket)
          ? CATEGORY_LABELS[effectiveCategory(ticket)!]
          : null,
        priority: effectivePriority(ticket),
        book: ticket.book,
        attachmentName: ticket.attachmentName,
        attachmentUrl: ticket.attachmentUrl,
        createdAt: ticket.createdAt,
        updatedAt: ticket.updatedAt,
        messages: ticket.messages.map((m) => ({
          id: m.id,
          body: m.body,
          isFromAdmin: m.isFromAdmin,
          senderName: m.sender.name,
          createdAt: m.createdAt,
        })),
      },
    });
  } catch (e) {
    next(e);
  }
});

export default router;
