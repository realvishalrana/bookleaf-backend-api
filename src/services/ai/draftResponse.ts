import { TicketCategory } from "@prisma/client";
import { env } from "../../config/env";
import { getKbSectionsForCategory } from "./knowledgeBase";
import { isAiAvailable, recordAiFailure, recordAiSuccess } from "./classifier";
import { openaiClient as openai } from "./client";
import { getAiErrorMessage, isRetryableAiError, sleep } from "./errors";

export interface DraftContext {
  subject: string;
  description: string;
  authorName: string;
  bookTitle?: string | null;
  bookStatus?: string | null;
  category: TicketCategory | null;
  recentMessages: { body: string; isFromAdmin: boolean }[];
}

export interface DraftResult {
  draft: string | null;
  error: string | null;
}

export async function generateDraftResponse(
  ctx: DraftContext
): Promise<DraftResult> {
  if (!openai) {
    return { draft: null, error: "OPENAI_API_KEY not set in .env" };
  }
  if (!isAiAvailable()) {
    return { draft: null, error: "AI temporarily paused after repeated failures" };
  }

  const kb = getKbSectionsForCategory(ctx.category);
  const recent = ctx.recentMessages
    .slice(-2)
    .map((m) => `${m.isFromAdmin ? "Support" : "Author"}: ${m.body}`)
    .join("\n");

  const system = `You are a BookLeaf Publishing support representative. Write a professional, empathetic reply.
Use only facts from the Knowledge Base. Do not invent policies. Keep under 250 words. No generic AI fluff.`;

  const user = `Author: ${ctx.authorName}
Book: ${ctx.bookTitle ?? "General / Account"} (${ctx.bookStatus ?? "N/A"})
Subject: ${ctx.subject}
Description: ${ctx.description}
${recent ? `Recent messages:\n${recent}` : ""}

Knowledge Base:
${kb}

Draft a reply to the author:`;

  let lastError: unknown;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await openai.chat.completions.create({
        model: env.OPENAI_DRAFT_MODEL,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        temperature: 0.5,
        max_tokens: 500,
      });

      const draft = res.choices[0]?.message?.content?.trim() ?? null;
      if (draft) {
        recordAiSuccess();
        return { draft, error: null };
      }
      return { draft: null, error: "AI returned an empty response" };
    } catch (err) {
      lastError = err;
      console.error("AI draft failed:", err);
      if (attempt === 0 && isRetryableAiError(err)) {
        await sleep(2000);
        continue;
      }
      break;
    }
  }

  const message = getAiErrorMessage(lastError);
  recordAiFailure(lastError);
  return { draft: null, error: message };
}
