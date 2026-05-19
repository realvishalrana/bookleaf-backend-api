import { Router } from "express";
import { booksController } from "./books.controller";

const router = Router();

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
router.get("/", booksController.list);

export default router;
