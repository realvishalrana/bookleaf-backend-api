import { z } from "zod";

export const ticketListQuerySchema = z.object({
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export type TicketListQuery = z.infer<typeof ticketListQuerySchema>;

export const createTicketBodySchema = z.object({
  bookId: z.string().nullable().optional(),
  subject: z.string().min(3).max(200),
  description: z.string().min(10).max(5000),
});

export type CreateTicketInput = z.infer<typeof createTicketBodySchema>;
