import path from "path";
import dotenv from "dotenv";
import { z } from "zod";

// Load .env from project root (works with ts-node-dev and compiled dist/)
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(8),
  JWT_EXPIRES_IN: z.string().default("7d"),
  OPENAI_API_KEY: z.string().optional(),
  /** Antigravity: http://127.0.0.1:8045/v1 — leave empty for api.openai.com */
  OPENAI_BASE_URL: z
    .string()
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  OPENAI_CLASSIFY_MODEL: z.string().default("gpt-4o-mini"),
  OPENAI_DRAFT_MODEL: z.string().default("gpt-4o"),
  CORS_ORIGIN_AUTHOR: z.string().default("http://localhost:3000"),
  CORS_ORIGIN_ADMIN: z.string().default("http://localhost:3001"),
  PORT: z.coerce.number().default(4000),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error("Invalid environment variables:", parsed.error.flatten().fieldErrors);
    throw new Error("Invalid environment configuration");
  }
  return parsed.data;
}

export const env = loadEnv();
