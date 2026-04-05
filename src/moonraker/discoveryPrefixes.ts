/**
 * /24 prefixes (a.b.c) from saved printer URLs whose host is an IPv4 address.
 * Used to scan those subnets first on the Rust discovery path.
 */
export function farmPrioritySubnetPrefixes(baseUrls: string[]): string[] {
  const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  const seen = new Set<string>();
  const out: string[] = [];

  for (const raw of baseUrls) {
    try {
      const host = new URL(raw).hostname;
      const m = host.match(ipv4);
      if (!m) {
        continue;
      }
      const a = Number(m[1]);
      const b = Number(m[2]);
      const c = Number(m[3]);
      const d = Number(m[4]);
      if ([a, b, c, d].some((n) => n > 255 || !Number.isInteger(n))) {
        continue;
      }
      const prefix = `${a}.${b}.${c}`;
      if (!seen.has(prefix)) {
        seen.add(prefix);
        out.push(prefix);
      }
    } catch {
      /* ignore */
    }
  }

  return out;
}
