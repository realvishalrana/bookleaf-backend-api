import { Priority, TicketCategory, TicketStatus } from "@prisma/client";
import { prisma } from "../../../shared/lib/prisma";
import type { CreateTicketInput, TicketListQuery } from "./author-tickets.schema";

export const authorTicketsRepository = {
  countForAuthor(authorId: string, search?: string) {
    return prisma.ticket.count({
      where: {
        authorId,
        ...(search ? { subject: { contains: search } } : {}),
      },
    });
  },

  findManyForAuthor(authorId: string, query: TicketListQuery) {
    const where = {
      authorId,
      ...(query.search ? { subject: { contains: query.search } } : {}),
    };
    return prisma.ticket.findMany({
      where,
      include: {
        book: { select: { id: true, title: true } },
        messages: { orderBy: { createdAt: "asc" as const }, take: 1 },
      },
      orderBy: { createdAt: "desc" as const },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    });
  },

  findByIdForAuthor(ticketId: string, authorId: string) {
    return prisma.ticket.findFirst({
      where: { id: ticketId, authorId },
      include: {
        book: { select: { id: true, title: true, status: true } },
        messages: {
          orderBy: { createdAt: "asc" },
          include: { sender: { select: { name: true, role: true } } },
        },
      },
    });
  },

  create(data: {
    authorId: string;
    bookId: string | null;
    subject: string;
    description: string;
    attachmentName?: string;
    attachmentUrl?: string;
  }) {
    return prisma.ticket.create({
      data,
      include: { book: { select: { title: true } } },
    });
  },

  updateTriage(
    ticketId: string,
    triage: { category: TicketCategory; priority: Priority } | null,
    triageError: string | null
  ) {
    return prisma.ticket.update({
      where: { id: ticketId },
      data: triage
        ? {
            aiCategory: triage.category,
            aiPriority: triage.priority,
            aiLastError: null,
          }
        : {
            aiLastError: triageError ?? "AI classification unavailable",
          },
      include: { book: { select: { id: true, title: true } } },
    });
  },

  findOpenTicketsExcluding(ticketId: string) {
    return prisma.ticket.findMany({
      where: { status: { in: [TicketStatus.OPEN, TicketStatus.IN_PROGRESS] }, id: { not: ticketId } },
      select: { id: true, subject: true, description: true },
    });
  },

  setSimilarTicketIds(ticketId: string, similarIds: string[]) {
    return prisma.ticket.update({
      where: { id: ticketId },
      data: { aiSimilarTicketIds: similarIds.join(",") },
    });
  },
};
