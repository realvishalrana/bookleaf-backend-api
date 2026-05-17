import { openaiClient as openai } from "./client";
import { getAiErrorMessage, sleep, isRetryableAiError } from "./errors";
import { isAiAvailable, recordAiFailure, recordAiSuccess } from "./classifier";

export interface OpenTicketStub {
  id: string;
  subject: string;
  description: string;
}

export interface DuplicateResult {
  similarIds: string[];
  error: string | null;
}

export async function findDuplicates(
  newSubject: string,
  newDescription: string,
  openTickets: OpenTicketStub[]
): Promise<DuplicateResult> {
  if (!openai) return { similarIds: [], error: null };
  if (!isAiAvailable()) return { similarIds: [], error: null };
  if (openTickets.length === 0) return { similarIds: [], error: null };

  // Cap at 50 tickets to stay within token budget
  const candidates = openTickets.slice(0, 50);

  const ticketList = candidates
    .map((t) => `ID: ${t.id}\nSubject: ${t.subject}\nDescription: ${t.description.slice(0, 200)}`)
    .join("\n---\n");

  const system = `You are a support ticket deduplication assistant for BookLeaf Publishing.
Compare a new support ticket against existing open tickets and identify which ones describe the same or very similar issue.
Respond ONLY with valid JSON: {"similarIds": ["id1", "id2"], "reasoning": "brief reason"}
Return an empty array if no similar tickets exist. Return at most 5 IDs. Be conservative — only flag genuinely similar issues.`;

  const user = `NEW TICKET:
Subject: ${newSubject}
Description: ${newDescription.slice(0, 400)}

EXISTING OPEN TICKETS:
${ticketList}`;

  let lastError: unknown;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await openai.chat.completions.create({
        model: process.env.OPENAI_CLASSIFY_MODEL ?? "llama-3.1-8b-instant",
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        temperature: 0.1,
        max_tokens: 200,
      });

      const raw = res.choices[0]?.message?.content ?? "";
      const jsonStr = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
      const parsed = JSON.parse(jsonStr) as { similarIds?: string[] };
      const similarIds = (parsed.similarIds ?? [])
        .filter((id): id is string => typeof id === "string")
        .slice(0, 5);

      recordAiSuccess();
      return { similarIds, error: null };
    } catch (err) {
      lastError = err;
      if (attempt === 0 && isRetryableAiError(err)) {
        await sleep(2000);
        continue;
      }
      break;
    }
  }

  recordAiFailure(lastError);
  return { similarIds: [], error: getAiErrorMessage(lastError) };
}
