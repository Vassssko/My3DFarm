type SortablePrinter = { id: string; baseUrl: string };

/** Parse IPv4 hostname to unsigned 32-bit; invalid octets → null. */
function ipv4ToUint32(host: string): number | null {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!m) {
    return null;
  }
  const parts = [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4])];
  if (parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return null;
  }
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

type SortKey =
  | { kind: "ip"; ip: number; port: number }
  | { kind: "host"; host: string };

function printerSortKey(p: SortablePrinter): SortKey {
  try {
    const u = new URL(p.baseUrl);
    const ip = ipv4ToUint32(u.hostname);
    const port = u.port ? Number(u.port) : u.protocol === "https:" ? 443 : 80;
    if (ip !== null) {
      return { kind: "ip", ip, port };
    }
    return { kind: "host", host: u.hostname.toLowerCase() };
  } catch {
    return { kind: "host", host: "\uffff" };
  }
}

/**
 * Ascending by IPv4 (numeric); same host ties broken by port then id.
 * Non-IPv4 hostnames sort after all IPv4, alphabetically by hostname then id.
 */
export function sortSavedPrintersByIp<T extends SortablePrinter>(printers: T[]): T[] {
  return [...printers].sort((a, b) => {
    const ka = printerSortKey(a);
    const kb = printerSortKey(b);
    if (ka.kind === "ip" && kb.kind === "ip") {
      if (ka.ip !== kb.ip) {
        return ka.ip < kb.ip ? -1 : 1;
      }
      if (ka.port !== kb.port) {
        return ka.port - kb.port;
      }
      return a.id.localeCompare(b.id);
    }
    if (ka.kind === "ip") {
      return -1;
    }
    if (kb.kind === "ip") {
      return 1;
    }
    const hc = ka.host.localeCompare(kb.host);
    if (hc !== 0) {
      return hc;
    }
    return a.id.localeCompare(b.id);
  });
}
