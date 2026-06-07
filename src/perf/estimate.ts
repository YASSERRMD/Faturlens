// Throughput benchmark → per-page time estimates. Pure math, unit-tested.

/** Expected generated tokens for a two-pass page (transcription + extraction). */
export const EXPECTED_TOKENS_PER_PAGE = 1200;

/** Convert a warmup run (tokens over milliseconds) into tokens/second. */
export function benchmarkToTps(tokens: number, elapsedMs: number): number {
  if (elapsedMs <= 0) return 0;
  return tokens / (elapsedMs / 1000);
}

/** Seconds to process one page at a given throughput. */
export function estimatePageSeconds(
  tokensPerSecond: number,
  expectedTokens = EXPECTED_TOKENS_PER_PAGE,
): number {
  if (tokensPerSecond <= 0) return Infinity;
  return expectedTokens / tokensPerSecond;
}

/** Human-friendly estimate string for the UI. */
export function formatEstimate(seconds: number): string {
  if (!Number.isFinite(seconds)) return 'unknown';
  if (seconds < 90) return `~${String(Math.round(seconds))}s`;
  return `~${String(Math.round(seconds / 60))} min`;
}

/** Total seconds for a batch of pages. */
export function estimateBatchSeconds(pageCount: number, tokensPerSecond: number): number {
  return pageCount * estimatePageSeconds(tokensPerSecond);
}
