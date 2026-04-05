/**
 * Network prefix field: commas → dots; only digits, dots, whitespace, newlines, semicolons (multi-prefix).
 */
export function sanitizeNetworkPrefixesInput(raw: string): string {
  const withDots = raw.replace(/,/g, ".");
  let out = "";
  for (const c of withDots) {
    if (/[\d.]/.test(c) || c === "\n" || c === "\r" || c === " " || c === "\t" || c === ";") {
      out += c;
    }
  }
  return out;
}
