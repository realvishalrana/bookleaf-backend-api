import * as fs from "fs";
import * as path from "path";
import { TicketCategory } from "@prisma/client";

const SECTION_MAP: Record<TicketCategory, string[]> = {
  ROYALTY_PAYMENTS: ["Royalty & Payments"],
  ISBN_METADATA: ["ISBN & Metadata Issues"],
  PRINTING_QUALITY: ["Printing & Quality"],
  DISTRIBUTION_AVAILABILITY: ["Distribution & Availability"],
  BOOK_STATUS_PRODUCTION: ["Book Status & Production Updates"],
  GENERAL_INQUIRY: ["General Inquiry"],
};

let cachedSections: Map<string, string> | null = null;

function loadSections(): Map<string, string> {
  if (cachedSections) return cachedSections;

  const filePath = path.join(__dirname, "../../data/knowledge-base.md");
  const content = fs.readFileSync(filePath, "utf-8");
  const sections = new Map<string, string>();

  const parts = content.split(/^## /m).filter(Boolean);
  for (const part of parts) {
    const newline = part.indexOf("\n");
    const title = part.slice(0, newline).trim();
    const body = part.slice(newline + 1).trim();
    sections.set(title, body);
  }

  cachedSections = sections;
  return sections;
}

export function getKbSectionsForCategory(category: TicketCategory | null): string {
  const sections = loadSections();
  const titles =
    category && SECTION_MAP[category]
      ? SECTION_MAP[category]
      : ["General Inquiry"];

  return titles
    .map((t) => `## ${t}\n${sections.get(t) ?? ""}`)
    .join("\n\n");
}
