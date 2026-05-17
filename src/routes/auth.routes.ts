import { Router } from "express";
import bcrypt from "bcrypt";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { authenticate, signToken } from "../middleware/auth";
import { validateBody } from "../middleware/validate";

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

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
router.post("/login", validateBody(loginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body as z.infer<typeof loginSchema>;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    const token = signToken(user);
    res.json({
      accessToken: token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        authorId: user.authorId,
        name: user.name,
      },
    });
  } catch (e) {
    next(e);
  }
});

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
router.get("/me", authenticate, (req, res) => {
  res.json({ user: req.user });
});

export default router;
