import { Router } from "express";
import { adminsController } from "./admins.controller";

const router = Router();

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
router.get("/", adminsController.list);

export default router;
