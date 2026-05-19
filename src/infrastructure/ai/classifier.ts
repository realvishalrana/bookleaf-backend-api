import { Priority, TicketCategory } from "@prisma/client";
import { env } from "../../config/env";
import { openaiClient as openai } from "./client";
import { getAiErrorMessage, isRetryableAiError, sleep } from "./errors";

const CATEGORIES = [
  "ROYALTY_PAYMENTS",
  "ISBN_METADATA",
  "PRINTING_QUALITY",
  "DISTRIBUTION_AVAILABILITY",
  "BOOK_STATUS_PRODUCTION",
  "GENERAL_INQUIRY",
] as const;

const PRIORITIES = ["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const;

export interface TriageResult {
  category: TicketCategory;
  priority: Priority;
  reasoning: string;
}

let circuitOpenUntil = 0;
let consecutiveFailures = 0;

export function isAiAvailable(): boolean {
  return Boolean(openai) && Date.now() > circuitOpenUntil;
}

export function recordAiSuccess(): void {
  consecutiveFailures = 0;
  circuitOpenUntil = 0;
}

export function recordAiFailure(err?: unknown): void {
  consecutiveFailures += 1;
  if (err && typeof err === "object" && (err as { status?: number }).status === 429) {
    return;
  }
  if (consecutiveFailures >= 3) {
    circuitOpenUntil = Date.now() + 5 * 60 * 1000;
  }
}

export async function triageTicket(
  subject: string,
  description: string
): Promise<{ result: TriageResult | null; error: string | null }> {
  if (!openai) {
    return { result: null, error: "OPENAI_API_KEY not set" };
  }
  if (!isAiAvailable()) {
    return { result: null, error: "AI temporarily unavailable" };
  }

  const system = `You are BookLeaf Publishing support triage. Classify tickets and assign priority.
Respond with JSON only: {"category":"...","priority":"...","reasoning":"..."}
Categories: ${CATEGORIES.join(", ")}
Priorities: ${PRIORITIES.join(", ")}
Rules: unpaid royalties 6+ months = CRITICAL or HIGH; printing defects = HIGH; bio/metadata minor updates = LOW; production status = MEDIUM.`;

  const user = `Subject: ${subject}\n\nDescription: ${description}`;

  let lastError: unknown;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await openai.chat.completions.create({
        model: env.OPENAI_CLASSIFY_MODEL,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        temperature: 0.2,
        max_tokens: 200,
      });

      const raw = res.choices[0]?.message?.content;
      if (!raw) {
        return { result: null, error: "Empty AI response" };
      }

      const jsonStr = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
      const parsed = JSON.parse(jsonStr) as {
        category: string;
        priority: string;
        reasoning: string;
      };

      if (
        !CATEGORIES.includes(parsed.category as (typeof CATEGORIES)[number]) ||
        !PRIORITIES.includes(parsed.priority as (typeof PRIORITIES)[number])
      ) {
        return { result: null, error: "Invalid category/priority from AI" };
      }

      recordAiSuccess();
      return {
        result: {
          category: parsed.category as TicketCategory,
          priority: parsed.priority as Priority,
          reasoning: parsed.reasoning ?? "",
        },
        error: null,
      };
    } catch (err) {
      lastError = err;
      console.error("AI triage failed:", err);
      if (attempt === 0 && isRetryableAiError(err)) {
        await sleep(2000);
        continue;
      }
      break;
    }
  }

  recordAiFailure(lastError);
  return { result: null, error: getAiErrorMessage(lastError) };
}
