/** Human-readable lines from Moonraker GET /machine/system_info (shape varies). */
export function extractHostOsFromSystemInfo(si: unknown): {
  distributionLine: string | null;
  cpuArchLine: string | null;
} {
  const root = si && typeof si === "object" ? (si as Record<string, unknown>) : {};
  const info = root.system_info;
  if (!info || typeof info !== "object") {
    return { distributionLine: null, cpuArchLine: null };
  }
  const inf = info as Record<string, unknown>;

  let distributionLine: string | null = null;
  const dist = inf.distribution;
  if (dist && typeof dist === "object") {
    const d = dist as Record<string, unknown>;
    const name = String(d.name ?? "").trim();
    const ver = String(d.version ?? "").trim();
    const codename = String(d.codename ?? "").trim();
    const bits: string[] = [];
    if (name) {
      bits.push(name);
    }
    if (ver) {
      bits.push(ver);
    }
    if (codename) {
      bits.push(codename);
    }
    distributionLine = bits.length > 0 ? bits.join(" · ") : null;
  }

  let cpuArchLine: string | null = null;
  const cpu = inf.cpu_info;
  if (cpu && typeof cpu === "object") {
    const c = cpu as Record<string, unknown>;
    const proc = String(c.processor ?? "").trim();
    const bits = String(c.bits ?? "").trim();
    const parts = [proc, bits].filter(Boolean);
    cpuArchLine = parts.length > 0 ? parts.join(" · ") : null;
  }

  return { distributionLine, cpuArchLine };
}
