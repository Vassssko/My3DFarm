/** First line, capped length, for minimal UI when full logs are developer-only. */
export function userFacingTechnicalSummary(
  full: string,
  maxLineLen = 200,
): { line: string; hasMore: boolean } {
  const t = full.trim();
  if (!t) {
    return { line: "", hasMore: false };
  }
  const first = t.split(/\r?\n/u)[0] ?? "";
  const multiline = /\r?\n/u.test(t);
  const long = first.length > maxLineLen;
  const line = long ? `${first.slice(0, Math.max(0, maxLineLen - 1))}…` : first;
  return { line, hasMore: multiline || long };
}
