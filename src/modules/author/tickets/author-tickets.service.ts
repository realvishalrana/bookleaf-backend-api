import { BadRequestError, NotFoundError } from "../../../shared/lib/errors";
import {
  effectiveCategory,
  effectivePriority,
  CATEGORY_LABELS,
} from "../../../shared/utils/ticket";
import { triageTicket } from "../../../infrastructure/ai/classifier";
import { findDuplicates } from "../../../infrastructure/ai/duplicates";
import { booksRepository } from "../books/books.repository";
import { authorTicketsRepository } from "./author-tickets.repository";
import type { CreateTicketInput, TicketListQuery } from "./author-tickets.schema";

function mapListItem(t: Awaited<ReturnType<typeof authorTicketsRepository.findManyForAuthor>>[number]) {
  const category = effectiveCategory(t);
  return {
    id: t.id,
    subject: t.subject,
    status: t.status,
    category,
    categoryLabel: category ? CATEGORY_LABELS[category] : null,
    priority: effectivePriority(t),
    book: t.book,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  };
}

export const authorTicketsService = {
  async list(authorId: string, query: TicketListQuery) {
    const [total, tickets] = await Promise.all([
      authorTicketsRepository.countForAuthor(authorId, query.search),
      authorTicketsRepository.findManyForAuthor(authorId, query),
    ]);

    return {
      tickets: tickets.map(mapListItem),
      total,
      page: query.page,
      totalPages: Math.max(1, Math.ceil(total / query.limit)),
    };
  },

  async getById(ticketId: string, authorId: string) {
    const ticket = await authorTicketsRepository.findByIdForAuthor(ticketId, authorId);
    if (!ticket) {
      throw new NotFoundError("Ticket not found");
    }

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
        book: ticket.book,
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
      },
    };
  },

  async create(
    authorId: string,
    input: CreateTicketInput,
    attachment?: { url: string; name: string }
  ) {
    const { bookId, subject, description } = input;

    if (bookId) {
      const book = await booksRepository.findByIdForAuthor(bookId, authorId);
      if (!book) {
        throw new BadRequestError("Invalid book for this author");
      }
    }

    const ticket = await authorTicketsRepository.create({
      authorId,
      bookId: bookId ?? null,
      subject,
      description,
      attachmentName: attachment?.name,
      attachmentUrl: attachment?.url,
    });

    const { result: triage, error: triageError } = await triageTicket(subject, description);
    const updated = await authorTicketsRepository.updateTriage(
      ticket.id,
      triage
        ? { category: triage.category, priority: triage.priority }
        : null,
      triageError
    );

    void authorTicketsService.runDuplicateDetection(ticket.id, subject, description);

    return {
      ticket: {
        id: updated.id,
        subject: updated.subject,
        status: updated.status,
        category: effectiveCategory(updated),
        priority: effectivePriority(updated),
        attachmentUrl: updated.attachmentUrl,
        book: updated.book,
        createdAt: updated.createdAt,
      },
    };
  },

  async runDuplicateDetection(ticketId: string, subject: string, description: string) {
    try {
      const openTickets = await authorTicketsRepository.findOpenTicketsExcluding(ticketId);
      const { similarIds } = await findDuplicates(subject, description, openTickets);
      if (similarIds.length > 0) {
        await authorTicketsRepository.setSimilarTicketIds(ticketId, similarIds);
      }
    } catch {
      // Non-critical
    }
  },
};
