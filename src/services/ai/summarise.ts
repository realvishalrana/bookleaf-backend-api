import { openaiClient as openai } from "./client";
import { getAiErrorMessage, isRetryableAiError, sleep } from "./errors";
import { isAiAvailable, recordAiFailure, recordAiSuccess } from "./classifier";

export interface ThreadMessage {
  body: string;
  isFromAdmin: boolean;
  createdAt: Date;
}

export interface SummariseResult {
  summary: string | null;
  error: string | null;
}

export async function summariseThread(
  subject: string,
  description: string,
  messages: ThreadMessage[]
): Promise<SummariseResult> {
  if (!openai) return { summary: null, error: "OPENAI_API_KEY not set" };
  if (!isAiAvailable()) return { summary: null, error: "AI temporarily unavailable" };

  const conversation = messages
    .map((m) => `${m.isFromAdmin ? "Support" : "Author"}: ${m.body}`)
    .join("\n");

  const system = `You are a support ticket summarisation assistant for BookLeaf Publishing.
Summarise the ticket thread in EXACTLY 3 sentences:
1. What the issue is.
2. What has been communicated or attempted so far.
3. What is still pending or unresolved.
Be concise and factual. Do not add opinions or greetings.`;

  const user = `Subject: ${subject}

Original description:
${description.slice(0, 600)}

${messages.length > 0 ? `Conversation:\n${conversation}` : "No replies yet."}`;

  let lastError: unknown;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await openai.chat.completions.create({
        model: process.env.OPENAI_DRAFT_MODEL ?? "llama-3.1-8b-instant",
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        temperature: 0.3,
        max_tokens: 300,
      });

      const summary = res.choices[0]?.message?.content?.trim() ?? null;
      if (summary) {
        recordAiSuccess();
        return { summary, error: null };
      }
      return { summary: null, error: "AI returned an empty response" };
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
  return { summary: null, error: getAiErrorMessage(lastError) };
}
