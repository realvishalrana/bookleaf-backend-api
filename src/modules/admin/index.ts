import { Router } from "express";
import { Role } from "@prisma/client";
import { authenticate, requireRole } from "../../shared/middleware/auth";
import adminTicketsRoutes from "./tickets/admin-tickets.routes";
import adminsRoutes from "./admins/admins.routes";

const router = Router();
router.use(authenticate, requireRole(Role.ADMIN));
router.use("/tickets", adminTicketsRoutes);
router.use("/admins", adminsRoutes);

export default router;
