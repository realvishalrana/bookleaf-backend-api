import { Router } from "express";
import {
  Role,
  TicketStatus,
  TicketCategory,
  Priority,
  Prisma,
} from "@prisma/client";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { authenticate, requireRole } from "../middleware/auth";
import { validateBody, validateQuery } from "../middleware/validate";
import { generateDraftResponse } from "../services/ai/draftResponse";
import { summariseThread } from "../services/ai/summarise";
import {
  effectiveCategory,
  effectivePriority,
  PRIORITY_WEIGHT,
  CATEGORY_LABELS,
} from "../utils/ticket";
import {
  emitTicketMessage,
  emitTicketUpdated,
} from "../services/realtime/socket";
import { paramId } from "../utils/params";

const router = Router();
router.use(authenticate, requireRole(Role.ADMIN));

const listQuerySchema = z.object({
  status: z.nativeEnum(TicketStatus).optional(),
  category: z.nativeEnum(TicketCategory).optional(),
  priority: z.nativeEnum(Priority).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  sort: z.enum(["urgency", "newest", "oldest"]).optional().default("urgency"),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

/**
 * @openapi
 * /api/v1/admin/tickets:
 *   get:
 *     tags: [Admin]
 *     summary: Ticket queue with filters and urgency sort
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { $ref: '#/components/schemas/TicketStatus' }
 *       - in: query
 *         name: category
 *         schema: { $ref: '#/components/schemas/TicketCategory' }
 *       - in: query
 *         name: priority
 *         schema: { $ref: '#/components/schemas/Priority' }
 *       - in: query
 *         name: from
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: to
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: sort
 *         schema: { type: string, enum: [urgency, newest, oldest], default: urgency }
 *     responses:
 *       200:
 *         description: Filtered ticket list
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Not an admin
 */
router.get("/tickets", validateQuery(listQuerySchema), async (req, res, next) => {
  try {
    const q = req.query as unknown as z.infer<typeof listQuerySchema>;
    const where: Prisma.TicketWhereInput = {};

    if (q.status) {
      where.status = q.status;
    } else {
      where.status = { notIn: [TicketStatus.CLOSED] };
    }
    if (q.from || q.to) {
      where.createdAt = {
        ...(q.from ? { gte: new Date(q.from) } : {}),
        ...(q.to ? { lte: new Date(q.to) } : {}),
      };
    }
    if (q.search) {
      where.OR = [
        { subject: { contains: q.search } },
        { author: { name: { contains: q.search } } },
      ];
    }

    const tickets = await prisma.ticket.findMany({
      where,
      include: {
        author: { select: { id: true, name: true, email: true } },
        book: { select: { id: true, title: true } },
        assignedAdmin: { select: { id: true, name: true, email: true } },
      },
    });

    // category/priority are computed from AI + admin overrides — filter in JS
    let filtered = tickets;
    if (q.category) {
      filtered = filtered.filter((t) => effectiveCategory(t) === q.category);
    }
    if (q.priority) {
      filtered = filtered.filter((t) => effectivePriority(t) === q.priority);
    }

    const sorted = [...filtered].sort((a, b) => {
      if (q.sort === "newest")
        return b.createdAt.getTime() - a.createdAt.getTime();
      if (q.sort === "oldest")
        return a.createdAt.getTime() - b.createdAt.getTime();
      const pa = effectivePriority(a);
      const pb = effectivePriority(b);
      const wa = pa ? PRIORITY_WEIGHT[pa] : 0;
      const wb = pb ? PRIORITY_WEIGHT[pb] : 0;
      if (wb !== wa) return wb - wa;
      return a.createdAt.getTime() - b.createdAt.getTime();
    });

    const total = sorted.length;
    const totalPages = Math.max(1, Math.ceil(total / q.limit));
    const paged = sorted.slice((q.page - 1) * q.limit, q.page * q.limit);

    res.json({
      tickets: paged.map((t) => ({
        id: t.id,
        subject: t.subject,
        status: t.status,
        category: effectiveCategory(t),
        categoryLabel: effectiveCategory(t)
          ? CATEGORY_LABELS[effectiveCategory(t)!]
          : null,
        priority: effectivePriority(t),
        aiCategory: t.aiCategory,
        aiPriority: t.aiPriority,
        adminCategory: t.adminCategory,
        adminPriority: t.adminPriority,
        aiLastError: t.aiLastError,
        author: t.author,
        book: t.book,
        assignedAdmin: t.assignedAdmin,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
      })),
      total,
      page: q.page,
      totalPages,
    });
  } catch (e) {
    next(e);
  }
});

async function ensureDraft(ticketId: string): Promise<string | null> {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: {
      author: true,
      book: true,
      messages: { orderBy: { createdAt: "asc" }, take: 5 },
    },
  });
  if (!ticket) return null;
  if (ticket.aiDraftResponse) return ticket.aiDraftResponse;
  // Don't retry on every page load if already rate-limited
  if (ticket.aiLastError?.toLowerCase().includes("rate limit")) return null;

  const { draft, error } = await generateDraftResponse({
    subject: ticket.subject,
    description: ticket.description,
    authorName: ticket.author.name,
    bookTitle: ticket.book?.title,
    bookStatus: ticket.book?.status,
    category: effectiveCategory(ticket),
    recentMessages: ticket.messages.map((m) => ({
      body: m.body,
      isFromAdmin: m.isFromAdmin,
    })),
  });

  if (draft) {
    await prisma.ticket.update({
      where: { id: ticketId },
      data: { aiDraftResponse: draft, aiLastError: null },
    });
    return draft;
  }
  if (error) {
    await prisma.ticket.update({
      where: { id: ticketId },
      data: { aiLastError: error },
    });
  }
  return null;
}

/**
 * @openapi
 * /api/v1/admin/tickets/{id}:
 *   get:
 *     tags: [Admin]
 *     summary: Get ticket detail (messages, internal notes, AI draft)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Full ticket including aiDraftResponse
 *       404:
 *         description: Ticket not found
 */
router.get("/tickets/:id", async (req, res, next) => {
  try {
    const ticket = await prisma.ticket.findUnique({
      where: { id: paramId(req) },
      include: {
        author: true,
        book: true,
        assignedAdmin: { select: { id: true, name: true, email: true } },
        messages: {
          orderBy: { createdAt: "asc" },
          include: { sender: { select: { name: true, role: true } } },
        },
        notes: {
          orderBy: { createdAt: "asc" },
          include: { admin: { select: { name: true } } },
        },
      },
    });

    if (!ticket) {
      res.status(404).json({ error: "Ticket not found" });
      return;
    }

    const draft = await ensureDraft(ticket.id);

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
        aiCategory: ticket.aiCategory,
        aiPriority: ticket.aiPriority,
        adminCategory: ticket.adminCategory,
        adminPriority: ticket.adminPriority,
        aiDraftResponse: draft ?? ticket.aiDraftResponse,
        aiLastError: ticket.aiLastError,
        author: ticket.author,
        book: ticket.book,
        assignedAdmin: ticket.assignedAdmin,
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
        notes: ticket.notes.map((n) => ({
          id: n.id,
          body: n.body,
          adminName: n.admin.name,
          createdAt: n.createdAt,
        })),
      },
    });
  } catch (e) {
    next(e);
  }
});

const patchSchema = z.object({
  status: z.nativeEnum(TicketStatus).optional(),
  adminCategory: z.nativeEnum(TicketCategory).optional(),
  adminPriority: z.nativeEnum(Priority).optional(),
  assignedAdminId: z.string().nullable().optional(),
});

/**
 * @openapi
 * /api/v1/admin/tickets/{id}:
 *   patch:
 *     tags: [Admin]
 *     summary: Update ticket status, category, priority, or assignee
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status: { $ref: '#/components/schemas/TicketStatus' }
 *               adminCategory: { $ref: '#/components/schemas/TicketCategory' }
 *               adminPriority: { $ref: '#/components/schemas/Priority' }
 *               assignedAdminId: { type: string, nullable: true }
 *     responses:
 *       200:
 *         description: Ticket updated
 *       400:
 *         description: Invalid admin assignee
 *       404:
 *         description: Ticket not found
 */
router.patch(
  "/tickets/:id",
  validateBody(patchSchema),
  async (req, res, next) => {
    try {
      const data = req.body as z.infer<typeof patchSchema>;
      if (data.assignedAdminId === req.user!.id || data.assignedAdminId) {
        if (data.assignedAdminId) {
          const admin = await prisma.user.findFirst({
            where: { id: data.assignedAdminId, role: Role.ADMIN },
          });
          if (!admin) {
            res.status(400).json({ error: "Invalid admin user" });
            return;
          }
        }
      }

      const ticket = await prisma.ticket.update({
        where: { id: paramId(req) },
        data: {
          ...(data.status !== undefined && { status: data.status }),
          ...(data.adminCategory !== undefined && {
            adminCategory: data.adminCategory,
          }),
          ...(data.adminPriority !== undefined && {
            adminPriority: data.adminPriority,
          }),
          ...(data.assignedAdminId !== undefined && {
            assignedAdminId: data.assignedAdminId,
          }),
        },
        include: {
          author: { select: { id: true, name: true } },
          book: { select: { id: true, title: true } },
          assignedAdmin: { select: { id: true, name: true } },
        },
      });

      const payload = {
        id: ticket.id,
        status: ticket.status,
        category: effectiveCategory(ticket),
        priority: effectivePriority(ticket),
        updatedAt: ticket.updatedAt,
      };
      emitTicketUpdated(ticket.id, ticket.authorId, payload);

      res.json({ ticket: payload });
    } catch (e) {
      next(e);
    }
  }
);

const messageSchema = z.object({
  body: z.string().min(1).max(10000),
  status: z.nativeEnum(TicketStatus).optional(),
});

/**
 * @openapi
 * /api/v1/admin/tickets/{id}/messages:
 *   post:
 *     tags: [Admin]
 *     summary: Send reply to author (visible on author ticket view)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [body]
 *             properties:
 *               body: { type: string }
 *               status: { $ref: '#/components/schemas/TicketStatus' }
 *     responses:
 *       201:
 *         description: Message sent (real-time event emitted)
 *       404:
 *         description: Ticket not found
 */
router.post(
  "/tickets/:id/messages",
  validateBody(messageSchema),
  async (req, res, next) => {
    try {
      const { body, status } = req.body as z.infer<typeof messageSchema>;
      const ticket = await prisma.ticket.findUnique({
        where: { id: paramId(req) },
      });
      if (!ticket) {
        res.status(404).json({ error: "Ticket not found" });
        return;
      }

      const [message, updated] = await prisma.$transaction([
        prisma.ticketMessage.create({
          data: {
            ticketId: ticket.id,
            senderId: req.user!.id,
            body,
            isFromAdmin: true,
          },
        }),
        prisma.ticket.update({
          where: { id: ticket.id },
          data: {
            status:
              status ??
              (ticket.status === TicketStatus.OPEN
                ? TicketStatus.IN_PROGRESS
                : ticket.status),
            assignedAdminId: ticket.assignedAdminId ?? req.user!.id,
          },
        }),
      ]);

      const msgPayload = {
        id: message.id,
        ticketId: ticket.id,
        body: message.body,
        isFromAdmin: true,
        createdAt: message.createdAt,
      };
      emitTicketMessage(ticket.id, ticket.authorId, msgPayload);
      emitTicketUpdated(ticket.id, ticket.authorId, {
        id: ticket.id,
        status: updated.status,
      });

      res.status(201).json({ message: msgPayload });
    } catch (e) {
      next(e);
    }
  }
);

const noteSchema = z.object({ body: z.string().min(1).max(5000) });

/**
 * @openapi
 * /api/v1/admin/tickets/{id}/notes:
 *   post:
 *     tags: [Admin]
 *     summary: Add internal note (not visible to author)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [body]
 *             properties:
 *               body: { type: string }
 *     responses:
 *       201:
 *         description: Note created
 *       404:
 *         description: Ticket not found
 */
router.post(
  "/tickets/:id/notes",
  validateBody(noteSchema),
  async (req, res, next) => {
    try {
      const { body } = req.body as z.infer<typeof noteSchema>;
      const ticket = await prisma.ticket.findUnique({
        where: { id: paramId(req) },
      });
      if (!ticket) {
        res.status(404).json({ error: "Ticket not found" });
        return;
      }

      const note = await prisma.ticketNote.create({
        data: {
          ticketId: ticket.id,
          adminId: req.user!.id,
          body,
        },
        include: { admin: { select: { name: true } } },
      });

      res.status(201).json({
        note: {
          id: note.id,
          body: note.body,
          adminName: note.admin.name,
          createdAt: note.createdAt,
        },
      });
    } catch (e) {
      next(e);
    }
  }
);

/**
 * @openapi
 * /api/v1/admin/tickets/{id}/ai/draft:
 *   post:
 *     tags: [Admin]
 *     summary: Regenerate AI draft response for a ticket
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: New draft text
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 draft: { type: string }
 *       503:
 *         description: AI unavailable
 *       404:
 *         description: Ticket not found
 */
router.post("/tickets/:id/ai/draft", async (req, res, next) => {
  try {
    const ticket = await prisma.ticket.findUnique({
      where: { id: paramId(req) },
      include: {
        author: true,
        book: true,
        messages: { orderBy: { createdAt: "asc" } },
      },
    });
    if (!ticket) {
      res.status(404).json({ error: "Ticket not found" });
      return;
    }

    const { draft, error } = await generateDraftResponse({
      subject: ticket.subject,
      description: ticket.description,
      authorName: ticket.author.name,
      bookTitle: ticket.book?.title,
      bookStatus: ticket.book?.status,
      category: effectiveCategory(ticket),
      recentMessages: ticket.messages.map((m) => ({
        body: m.body,
        isFromAdmin: m.isFromAdmin,
      })),
    });

    if (!draft) {
      const errMsg = error ?? "AI draft generation unavailable";
      await prisma.ticket.update({
        where: { id: ticket.id },
        data: { aiLastError: errMsg },
      });
      res.status(503).json({
        error: "AI unavailable",
        message: errMsg,
      });
      return;
    }

    await prisma.ticket.update({
      where: { id: ticket.id },
      data: { aiDraftResponse: draft, aiLastError: null },
    });

    res.json({ draft });
  } catch (e) {
    next(e);
  }
});

/**
 * @openapi
 * /api/v1/admin/tickets/{id}/ai/duplicates:
 *   get:
 *     tags: [Admin]
 *     summary: Get similar open tickets detected by AI for a given ticket
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: List of similar tickets
 *       404:
 *         description: Ticket not found
 */
router.get("/tickets/:id/ai/duplicates", async (req, res, next) => {
  try {
    const ticket = await prisma.ticket.findUnique({
      where: { id: paramId(req) },
      select: { aiSimilarTicketIds: true },
    });
    if (!ticket) {
      res.status(404).json({ error: "Ticket not found" });
      return;
    }

    if (!ticket.aiSimilarTicketIds) {
      res.json({ similar: [] });
      return;
    }

    const ids = ticket.aiSimilarTicketIds.split(",").filter(Boolean);
    const similar = await prisma.ticket.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        subject: true,
        status: true,
        createdAt: true,
        author: { select: { id: true, name: true } },
      },
    });

    res.json({ similar });
  } catch (e) {
    next(e);
  }
});

/**
 * @openapi
 * /api/v1/admin/tickets/{id}/ai/summary:
 *   post:
 *     tags: [Admin]
 *     summary: Generate (or return cached) AI thread summary
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: 3-sentence thread summary
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 summary: { type: string }
 *                 cached: { type: boolean }
 *       503:
 *         description: AI unavailable
 *       404:
 *         description: Ticket not found
 */
router.post("/tickets/:id/ai/summary", async (req, res, next) => {
  try {
    const ticket = await prisma.ticket.findUnique({
      where: { id: paramId(req) },
      include: {
        messages: { orderBy: { createdAt: "asc" } },
      },
    });
    if (!ticket) {
      res.status(404).json({ error: "Ticket not found" });
      return;
    }

    // Return cached summary immediately
    if (ticket.aiSummary) {
      res.json({ summary: ticket.aiSummary, cached: true });
      return;
    }

    const { summary, error } = await summariseThread(
      ticket.subject,
      ticket.description,
      ticket.messages.map((m) => ({
        body: m.body,
        isFromAdmin: m.isFromAdmin,
        createdAt: m.createdAt,
      }))
    );

    if (!summary) {
      res.status(503).json({ error: "AI unavailable", message: error ?? "Failed to summarise" });
      return;
    }

    await prisma.ticket.update({
      where: { id: ticket.id },
      data: { aiSummary: summary },
    });

    res.json({ summary, cached: false });
  } catch (e) {
    next(e);
  }
});

/**
 * @openapi
 * /api/v1/admin/admins:
 *   get:
 *     tags: [Admin]
 *     summary: List admin users (for ticket assignment dropdown)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Admin users
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 admins:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: string }
 *                       name: { type: string }
 *                       email: { type: string }
 */
router.get("/admins", async (_req, res, next) => {
  try {
    const admins = await prisma.user.findMany({
      where: { role: Role.ADMIN },
      select: { id: true, name: true, email: true },
    });
    res.json({ admins });
  } catch (e) {
    next(e);
  }
});

export default router;
