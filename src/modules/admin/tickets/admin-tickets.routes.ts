import { Router } from "express";
import { validateBody, validateQuery } from "../../../shared/middleware/validate";
import {
  listQuerySchema,
  patchSchema,
  messageSchema,
  noteSchema,
} from "./admin-tickets.schema";
import { adminTicketsController } from "./admin-tickets.controller";

const router = Router();

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
router.get("/", validateQuery(listQuerySchema), adminTicketsController.list);

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
router.get("/:id", adminTicketsController.getById);

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
router.patch("/:id", validateBody(patchSchema), adminTicketsController.patch);

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
  "/:id/messages",
  validateBody(messageSchema),
  adminTicketsController.sendMessage
);

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
  "/:id/notes",
  validateBody(noteSchema),
  adminTicketsController.addNote
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
router.post("/:id/ai/draft", adminTicketsController.regenerateDraft);

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
router.get("/:id/ai/duplicates", adminTicketsController.getDuplicates);

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
router.post("/:id/ai/summary", adminTicketsController.summarise);

export default router;
