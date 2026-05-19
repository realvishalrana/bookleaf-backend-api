import { TicketStatus, TicketCategory, Priority } from "@prisma/client";
import { z } from "zod";

export const listQuerySchema = z.object({
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

export type AdminTicketListQuery = z.infer<typeof listQuerySchema>;

export const patchSchema = z.object({
  status: z.nativeEnum(TicketStatus).optional(),
  adminCategory: z.nativeEnum(TicketCategory).optional(),
  adminPriority: z.nativeEnum(Priority).optional(),
  assignedAdminId: z.string().nullable().optional(),
});

export type PatchTicketInput = z.infer<typeof patchSchema>;

export const messageSchema = z.object({
  body: z.string().min(1).max(10000),
  status: z.nativeEnum(TicketStatus).optional(),
});

export type MessageInput = z.infer<typeof messageSchema>;

export const noteSchema = z.object({ body: z.string().min(1).max(5000) });

export type NoteInput = z.infer<typeof noteSchema>;
