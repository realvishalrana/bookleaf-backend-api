import { Router } from "express";
import { authenticate } from "../../shared/middleware/auth";
import { validateBody } from "../../shared/middleware/validate";
import { loginSchema } from "./auth.schema";
import { authController } from "./auth.controller";

const router = Router();

/**
 * @openapi
 * /api/v1/auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Login with email and password
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *     responses:
 *       200:
 *         description: JWT access token and user profile
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 accessToken: { type: string }
 *                 user: { $ref: '#/components/schemas/User' }
 *       401:
 *         description: Invalid credentials
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.post("/login", validateBody(loginSchema), authController.login);

/**
 * @openapi
 * /api/v1/auth/me:
 *   get:
 *     tags: [Auth]
 *     summary: Get current authenticated user
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Current user
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user: { $ref: '#/components/schemas/User' }
 *       401:
 *         description: Unauthorized
 */
router.get("/me", authenticate, authController.me);

export default router;
