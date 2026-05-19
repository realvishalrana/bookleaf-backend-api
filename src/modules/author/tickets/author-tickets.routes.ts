import { Router, Request, Response, NextFunction } from "express";
import { validateQuery } from "../../../shared/middleware/validate";
import { uploadSingle } from "../../../shared/middleware/upload";
import { createTicketBodySchema, ticketListQuerySchema } from "./author-tickets.schema";
import { authorTicketsController } from "./author-tickets.controller";

const router = Router();

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
router.get(
  "/",
  validateQuery(ticketListQuerySchema),
  authorTicketsController.list
);

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
  "/",
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
    const parsed = createTicketBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten().fieldErrors });
      return;
    }
    req.body = parsed.data;
    return authorTicketsController.create(req, res, next);
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
router.get("/:id", authorTicketsController.getById);

export default router;
