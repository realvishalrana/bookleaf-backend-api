import {
  Prisma,
  TicketStatus,
  TicketCategory,
  Priority,
  Role,
} from "@prisma/client";
import { prisma } from "../../../shared/lib/prisma";
import type { AdminTicketListQuery } from "./admin-tickets.schema";

const ticketListInclude = {
  author: { select: { id: true, name: true, email: true } },
  book: { select: { id: true, title: true } },
  assignedAdmin: { select: { id: true, name: true, email: true } },
} satisfies Prisma.TicketInclude;

const ticketDetailInclude = {
  author: true,
  book: true,
  assignedAdmin: { select: { id: true, name: true, email: true } },
  messages: {
    orderBy: { createdAt: "asc" as const },
    include: { sender: { select: { name: true, role: true } } },
  },
  notes: {
    orderBy: { createdAt: "asc" as const },
    include: { admin: { select: { name: true } } },
  },
} satisfies Prisma.TicketInclude;

function categoryFilter(category: TicketCategory): Prisma.TicketWhereInput {
  return {
    OR: [
      { adminCategory: category },
      { adminCategory: null, aiCategory: category },
    ],
  };
}

function priorityFilter(priority: Priority): Prisma.TicketWhereInput {
  return {
    OR: [
      { adminPriority: priority },
      { adminPriority: null, aiPriority: priority },
    ],
  };
}

function buildListWhere(q: AdminTicketListQuery): Prisma.TicketWhereInput {
  const where: Prisma.TicketWhereInput = {};

  if (q.status) {
    where.status = q.status;
  } else {
    where.status = { notIn: [TicketStatus.CLOSED] };
  }

  if (q.from || q.to) {
    where.createdAt = {
      ...(q.from ? { gte: new Date(q.from) } : {}),
      ...(q.to ? { lte: new Date(q.to) } : {}),
    };
  }

  if (q.search) {
    where.OR = [
      { subject: { contains: q.search } },
      { author: { name: { contains: q.search } } },
    ];
  }

  const and: Prisma.TicketWhereInput[] = [];
  if (q.category) and.push(categoryFilter(q.category));
  if (q.priority) and.push(priorityFilter(q.priority));
  if (and.length > 0) {
    where.AND = and;
  }

  return where;
}

export const adminTicketsRepository = {
  buildListWhere,

  count(where: Prisma.TicketWhereInput) {
    return prisma.ticket.count({ where });
  },

  findManyForList(where: Prisma.TicketWhereInput) {
    return prisma.ticket.findMany({
      where,
      include: ticketListInclude,
    });
  },

  findManyPaginated(
    where: Prisma.TicketWhereInput,
    orderBy: Prisma.TicketOrderByWithRelationInput,
    skip: number,
    take: number
  ) {
    return prisma.ticket.findMany({
      where,
      include: ticketListInclude,
      orderBy,
      skip,
      take,
    });
  },

  findById(ticketId: string) {
    return prisma.ticket.findUnique({
      where: { id: ticketId },
      include: ticketDetailInclude,
    });
  },

  findByIdWithDraftContext(ticketId: string) {
    return prisma.ticket.findUnique({
      where: { id: ticketId },
      include: {
        author: true,
        book: true,
        messages: { orderBy: { createdAt: "asc" }, take: 5 },
      },
    });
  },

  findByIdWithMessages(ticketId: string) {
    return prisma.ticket.findUnique({
      where: { id: ticketId },
      include: {
        author: true,
        book: true,
        messages: { orderBy: { createdAt: "asc" } },
      },
    });
  },

  findByIdWithMessagesOnly(ticketId: string) {
    return prisma.ticket.findUnique({
      where: { id: ticketId },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });
  },

  findSimilarIds(ticketId: string) {
    return prisma.ticket.findUnique({
      where: { id: ticketId },
      select: { aiSimilarTicketIds: true },
    });
  },

  findTicketsByIds(ids: string[]) {
    return prisma.ticket.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        subject: true,
        status: true,
        createdAt: true,
        author: { select: { id: true, name: true } },
      },
    });
  },

  update(ticketId: string, data: Prisma.TicketUpdateInput) {
    return prisma.ticket.update({
      where: { id: ticketId },
      data,
      include: {
        author: { select: { id: true, name: true } },
        book: { select: { id: true, title: true } },
        assignedAdmin: { select: { id: true, name: true } },
      },
    });
  },

  updateAiFields(ticketId: string, data: Prisma.TicketUpdateInput) {
    return prisma.ticket.update({
      where: { id: ticketId },
      data,
    });
  },

  createMessage(data: {
    ticketId: string;
    senderId: string;
    body: string;
    isFromAdmin: boolean;
  }) {
    return prisma.ticketMessage.create({ data });
  },

  updateTicketStatus(ticketId: string, data: Prisma.TicketUpdateInput) {
    return prisma.ticket.update({
      where: { id: ticketId },
      data,
    });
  },

  createNote(data: { ticketId: string; adminId: string; body: string }) {
    return prisma.ticketNote.create({
      data,
      include: { admin: { select: { name: true } } },
    });
  },

  transaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>) {
    return prisma.$transaction(fn);
  },

  findAdminUser(id: string) {
    return prisma.user.findFirst({
      where: { id, role: Role.ADMIN },
    });
  },
};
