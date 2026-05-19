import { TicketStatus } from "@prisma/client";
import { prisma } from "../../../shared/lib/prisma";
import { generateDraftResponse } from "../../../infrastructure/ai/draftResponse";
import { summariseThread } from "../../../infrastructure/ai/summarise";
import {
  emitTicketMessage,
  emitTicketUpdated,
} from "../../../infrastructure/realtime/socket";
import {
  BadRequestError,
  NotFoundError,
  ServiceUnavailableError,
} from "../../../shared/lib/errors";
import {
  effectiveCategory,
  effectivePriority,
  PRIORITY_WEIGHT,
  CATEGORY_LABELS,
} from "../../../shared/utils/ticket";
import { adminsRepository } from "../admins/admins.repository";
import { adminTicketsRepository } from "./admin-tickets.repository";
import type {
  AdminTicketListQuery,
  MessageInput,
  NoteInput,
  PatchTicketInput,
} from "./admin-tickets.schema";

type ListTicket = Awaited<
  ReturnType<typeof adminTicketsRepository.findManyForList>
>[number];

function mapListTicket(t: ListTicket) {
  const category = effectiveCategory(t);
  return {
    id: t.id,
    subject: t.subject,
    status: t.status,
    category,
    categoryLabel: category ? CATEGORY_LABELS[category] : null,
    priority: effectivePriority(t),
    aiCategory: t.aiCategory,
    aiPriority: t.aiPriority,
    adminCategory: t.adminCategory,
    adminPriority: t.adminPriority,
    aiLastError: t.aiLastError,
    author: t.author,
    book: t.book,
    assignedAdmin: t.assignedAdmin,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  };
}

function sortByUrgency(tickets: ListTicket[]): ListTicket[] {
  return [...tickets].sort((a, b) => {
    const pa = effectivePriority(a);
    const pb = effectivePriority(b);
    const wa = pa ? PRIORITY_WEIGHT[pa] : 0;
    const wb = pb ? PRIORITY_WEIGHT[pb] : 0;
    if (wb !== wa) return wb - wa;
    return a.createdAt.getTime() - b.createdAt.getTime();
  });
}

export const adminTicketsService = {
  async list(query: AdminTicketListQuery) {
    const where = adminTicketsRepository.buildListWhere(query);

    if (query.sort === "newest" || query.sort === "oldest") {
      const orderBy =
        query.sort === "newest"
          ? { createdAt: "desc" as const }
          : { createdAt: "asc" as const };
      const skip = (query.page - 1) * query.limit;

      const [total, tickets] = await Promise.all([
        adminTicketsRepository.count(where),
        adminTicketsRepository.findManyPaginated(where, orderBy, skip, query.limit),
      ]);

      return {
        tickets: tickets.map(mapListTicket),
        total,
        page: query.page,
        totalPages: Math.max(1, Math.ceil(total / query.limit)),
      };
    }

    const all = await adminTicketsRepository.findManyForList(where);
    const sorted = sortByUrgency(all);
    const total = sorted.length;
    const paged = sorted.slice(
      (query.page - 1) * query.limit,
      query.page * query.limit
    );

    return {
      tickets: paged.map(mapListTicket),
      total,
      page: query.page,
      totalPages: Math.max(1, Math.ceil(total / query.limit)),
    };
  },

  async ensureDraft(ticketId: string): Promise<string | null> {
    const ticket = await adminTicketsRepository.findByIdWithDraftContext(ticketId);
    if (!ticket) return null;
    if (ticket.aiDraftResponse) return ticket.aiDraftResponse;
    if (ticket.aiLastError?.toLowerCase().includes("rate limit")) return null;

    const { draft, error } = await generateDraftResponse({
      subject: ticket.subject,
      description: ticket.description,
      authorName: ticket.author.name,
      bookTitle: ticket.book?.title,
      bookStatus: ticket.book?.status,
      category: effectiveCategory(ticket),
      recentMessages: ticket.messages.map((m) => ({
        body: m.body,
        isFromAdmin: m.isFromAdmin,
      })),
    });

    if (draft) {
      await adminTicketsRepository.updateAiFields(ticketId, {
        aiDraftResponse: draft,
        aiLastError: null,
      });
      return draft;
    }
    if (error) {
      await adminTicketsRepository.updateAiFields(ticketId, {
        aiLastError: error,
      });
    }
    return null;
  },

  async getById(ticketId: string) {
    const ticket = await adminTicketsRepository.findById(ticketId);
    if (!ticket) {
      throw new NotFoundError("Ticket not found");
    }

    const draft = await adminTicketsService.ensureDraft(ticket.id);
    const category = effectiveCategory(ticket);

    return {
      ticket: {
        id: ticket.id,
        subject: ticket.subject,
        description: ticket.description,
        status: ticket.status,
        category,
        categoryLabel: category ? CATEGORY_LABELS[category] : null,
        priority: effectivePriority(ticket),
        aiCategory: ticket.aiCategory,
        aiPriority: ticket.aiPriority,
        adminCategory: ticket.adminCategory,
        adminPriority: ticket.adminPriority,
        aiDraftResponse: draft ?? ticket.aiDraftResponse,
        aiLastError: ticket.aiLastError,
        author: ticket.author,
        book: ticket.book,
        assignedAdmin: ticket.assignedAdmin,
        attachmentName: ticket.attachmentName,
        attachmentUrl: ticket.attachmentUrl,
        createdAt: ticket.createdAt,
        updatedAt: ticket.updatedAt,
        messages: ticket.messages.map((m) => ({
          id: m.id,
          body: m.body,
          isFromAdmin: m.isFromAdmin,
          senderName: m.sender.name,
          createdAt: m.createdAt,
        })),
        notes: ticket.notes.map((n) => ({
          id: n.id,
          body: n.body,
          adminName: n.admin.name,
          createdAt: n.createdAt,
        })),
      },
    };
  },

  async patch(ticketId: string, data: PatchTicketInput) {
    if (data.assignedAdminId) {
      const admin = await adminsRepository.findAdminById(data.assignedAdminId);
      if (!admin) {
        throw new BadRequestError("Invalid admin user");
      }
    }

    const ticket = await adminTicketsRepository.update(ticketId, {
      ...(data.status !== undefined && { status: data.status }),
      ...(data.adminCategory !== undefined && {
        adminCategory: data.adminCategory,
      }),
      ...(data.adminPriority !== undefined && {
        adminPriority: data.adminPriority,
      }),
      ...(data.assignedAdminId !== undefined && {
        assignedAdminId: data.assignedAdminId,
      }),
    });

    const payload = {
      id: ticket.id,
      status: ticket.status,
      category: effectiveCategory(ticket),
      priority: effectivePriority(ticket),
      updatedAt: ticket.updatedAt,
    };
    emitTicketUpdated(ticket.id, ticket.authorId, payload);

    return { ticket: payload };
  },

  async sendMessage(ticketId: string, adminId: string, input: MessageInput) {
    const ticket = await adminTicketsRepository.findById(ticketId);
    if (!ticket) {
      throw new NotFoundError("Ticket not found");
    }

    const [message, updated] = await prisma.$transaction([
      prisma.ticketMessage.create({
        data: {
          ticketId: ticket.id,
          senderId: adminId,
          body: input.body,
          isFromAdmin: true,
        },
      }),
      prisma.ticket.update({
        where: { id: ticket.id },
        data: {
          status:
            input.status ??
            (ticket.status === TicketStatus.OPEN
              ? TicketStatus.IN_PROGRESS
              : ticket.status),
          assignedAdminId: ticket.assignedAdminId ?? adminId,
        },
      }),
    ]);

    const msgPayload = {
      id: message.id,
      ticketId: ticket.id,
      body: message.body,
      isFromAdmin: true,
      createdAt: message.createdAt,
    };
    emitTicketMessage(ticket.id, ticket.authorId, msgPayload);
    emitTicketUpdated(ticket.id, ticket.authorId, {
      id: ticket.id,
      status: updated.status,
    });

    return { message: msgPayload };
  },

  async addNote(ticketId: string, adminId: string, input: NoteInput) {
    const ticket = await adminTicketsRepository.findById(ticketId);
    if (!ticket) {
      throw new NotFoundError("Ticket not found");
    }

    const note = await adminTicketsRepository.createNote({
      ticketId: ticket.id,
      adminId,
      body: input.body,
    });

    return {
      note: {
        id: note.id,
        body: note.body,
        adminName: note.admin.name,
        createdAt: note.createdAt,
      },
    };
  },

  async regenerateDraft(ticketId: string) {
    const ticket = await adminTicketsRepository.findByIdWithMessages(ticketId);
    if (!ticket) {
      throw new NotFoundError("Ticket not found");
    }

    const { draft, error } = await generateDraftResponse({
      subject: ticket.subject,
      description: ticket.description,
      authorName: ticket.author.name,
      bookTitle: ticket.book?.title,
      bookStatus: ticket.book?.status,
      category: effectiveCategory(ticket),
      recentMessages: ticket.messages.map((m) => ({
        body: m.body,
        isFromAdmin: m.isFromAdmin,
      })),
    });

    if (!draft) {
      const errMsg = error ?? "AI draft generation unavailable";
      await adminTicketsRepository.updateAiFields(ticket.id, {
        aiLastError: errMsg,
      });
      throw new ServiceUnavailableError(errMsg);
    }

    await adminTicketsRepository.updateAiFields(ticket.id, {
      aiDraftResponse: draft,
      aiLastError: null,
    });

    return { draft };
  },

  async getDuplicates(ticketId: string) {
    const ticket = await adminTicketsRepository.findSimilarIds(ticketId);
    if (!ticket) {
      throw new NotFoundError("Ticket not found");
    }

    if (!ticket.aiSimilarTicketIds) {
      return { similar: [] };
    }

    const ids = ticket.aiSimilarTicketIds.split(",").filter(Boolean);
    const similar = await adminTicketsRepository.findTicketsByIds(ids);
    return { similar };
  },

  async summarise(ticketId: string) {
    const ticket = await adminTicketsRepository.findByIdWithMessagesOnly(ticketId);
    if (!ticket) {
      throw new NotFoundError("Ticket not found");
    }

    if (ticket.aiSummary) {
      return { summary: ticket.aiSummary, cached: true };
    }

    const { summary, error } = await summariseThread(
      ticket.subject,
      ticket.description,
      ticket.messages.map((m) => ({
        body: m.body,
        isFromAdmin: m.isFromAdmin,
        createdAt: m.createdAt,
      }))
    );

    if (!summary) {
      throw new ServiceUnavailableError(error ?? "Failed to summarise");
    }

    await adminTicketsRepository.updateAiFields(ticket.id, {
      aiSummary: summary,
    });

    return { summary, cached: false };
  },
};
