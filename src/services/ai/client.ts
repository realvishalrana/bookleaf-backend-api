import OpenAI from "openai";
import { env } from "../../config/env";

/** Shared OpenAI SDK client — works with OpenAI directly or Antigravity proxy. */
export const openaiClient: OpenAI | null = env.OPENAI_API_KEY
  ? new OpenAI({
      apiKey: env.OPENAI_API_KEY,
      ...(env.OPENAI_BASE_URL ? { baseURL: env.OPENAI_BASE_URL } : {}),
    })
  : null;
