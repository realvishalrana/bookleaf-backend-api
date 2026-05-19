export function getAiErrorMessage(err: unknown): string {
  if (err && typeof err === "object") {
    const e = err as { status?: number; message?: string };
    if (e.status === 429) {
      return "AI rate limit reached — wait a moment and try again";
    }
    if (e.status === 401 || e.status === 403) {
      return "Invalid API key — check OPENAI_API_KEY in .env";
    }
    if (e.status === 404) {
      return "Model not found — check OPENAI_CLASSIFY_MODEL / OPENAI_DRAFT_MODEL in .env";
    }
    if (e.message) return e.message;
  }
  return "AI request failed";
}

export function isRetryableAiError(err: unknown): boolean {
  if (err && typeof err === "object" && "status" in err) {
    const status = (err as { status?: number }).status;
    return status === 429 || status === 503;
  }
  return false;
}

export async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
