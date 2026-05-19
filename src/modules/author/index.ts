import { Router } from "express";
import { Role } from "@prisma/client";
import { authenticate, requireRole } from "../../shared/middleware/auth";
import booksRoutes from "./books/books.routes";
import authorTicketsRoutes from "./tickets/author-tickets.routes";

const router = Router();
router.use(authenticate, requireRole(Role.AUTHOR));
router.use("/books", booksRoutes);
router.use("/tickets", authorTicketsRoutes);

export default router;
