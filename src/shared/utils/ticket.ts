import { Priority, TicketCategory } from "@prisma/client";

export function effectiveCategory(ticket: {
  adminCategory: TicketCategory | null;
  aiCategory: TicketCategory | null;
}): TicketCategory | null {
  return ticket.adminCategory ?? ticket.aiCategory;
}

export function effectivePriority(ticket: {
  adminPriority: Priority | null;
  aiPriority: Priority | null;
}): Priority | null {
  return ticket.adminPriority ?? ticket.aiPriority;
}

export const PRIORITY_WEIGHT: Record<Priority, number> = {
  CRITICAL: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
};

export const CATEGORY_LABELS: Record<TicketCategory, string> = {
  ROYALTY_PAYMENTS: "Royalty & Payments",
  ISBN_METADATA: "ISBN & Metadata Issues",
  PRINTING_QUALITY: "Printing & Quality",
  DISTRIBUTION_AVAILABILITY: "Distribution & Availability",
  BOOK_STATUS_PRODUCTION: "Book Status & Production Updates",
  GENERAL_INQUIRY: "General Inquiry",
};
