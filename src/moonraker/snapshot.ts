import {
  fetchObjectsList,
  fetchObjectsQuery,
  fetchPrinterInfo,
  fetchProcStats,
  fetchServerInfoOutcome,
  normalizeBaseUrl,
} from "./client";
import type { MoonrakerServerInfo } from "./types";

export type CardStatus = "ready" | "printing" | "error" | "offline";

export type McuVersionRow = { name: string; version: string };

/** Raw inputs for status derivation (tests + offline simulation). */
export type StatusDerivationInput = {
  fetchFailed: boolean;
  klippy_connected?: boolean;
  klippy_state?: string;
  webhooks_state?: string;
  print_stats_state?: string;
};

export function deriveCardStatus(i: StatusDerivationInput): CardStatus {
  if (i.fetchFailed) {
    return "offline";
  }
  const wh = i.webhooks_state;
  if (wh === "error" || wh === "shutdown") {
    return "error";
  }
  if (i.klippy_connected === false) {
    return "error";
  }
  const ks = i.klippy_state;
  if (ks === "error" || ks === "shutdown") {
    return "error";
  }
  const ps = i.print_stats_state;
  if (ps === "printing" || ps === "paused") {
    return "printing";
  }
  if (ks === "startup" || ks === "disconnect" || ks === "disconnected") {
    return "printing";
  }
  return "ready";
}

/** System uptime for printer cards (language-aware). */
export function formatSystemUptime(sec: number | null, lang: string): string {
  if (sec == null || sec <= 0) {
    return "—";
  }
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const l = lang.toLowerCase();
  if (l.startsWith("ru")) {
    if (d > 0) {
      return `${d}д ${h}ч`;
    }
    if (h > 0) {
      return `${h}ч ${m}м`;
    }
    return `${m}м`;
  }
  if (d > 0) {
    return `${d}d ${h}h`;
  }
  if (h > 0) {
    return `${h}h ${m}m`;
  }
  return `${m}m`;
}

/** Compact duration for idle line (language-aware). */
export function formatWaitDuration(sec: number, lang: string): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (lang.startsWith("en")) {
    if (h > 0) {
      return `${h}h ${m}m`;
    }
    if (m > 0) {
      return `${m}m`;
    }
    return "< 1m";
  }
  if (lang.startsWith("zh")) {
    if (h > 0) {
      return `${h}小时${m}分`;
    }
    if (m > 0) {
      return `${m}分钟`;
    }
    return "< 1分钟";
  }
  if (h > 0) {
    return `${h} ч ${m} мин`;
  }
  if (m > 0) {
    return `${m} мин`;
  }
  return "< 1 мин";
}

export type PrinterSnapshot = {
  status: CardStatus;
  hostname: string;
  moonrakerVersion: string;
  klipperHostVersion: string;
  mcuVersions: McuVersionRow[];
  uptimeSec: number | null;
  printFilename: string | null;
  isActivelyPrinting: boolean;
  /** For idle line: Klippy ready + not printing */
  isIdleReady: boolean;
  /** Set when status is offline — explains failed /server/info */
  offlineDetail?: "auth" | "unreachable" | "http";
  httpStatus?: number;
  /** From /printer/info when the request succeeds (helps status tooltips). */
  printerInfo?: { state?: string; state_message?: string };
  raw: {
    server?: MoonrakerServerInfo;
    webhooks_state?: string;
    print_stats?: { state?: string; filename?: string };
  };
};

function pickWebhookState(status: Record<string, Record<string, unknown>>): string | undefined {
  const w = status.webhooks as { state?: string } | undefined;
  return w?.state;
}

function pickPrintStats(status: Record<string, Record<string, unknown>>): {
  state?: string;
  filename?: string;
} {
  const p = status.print_stats as { state?: string; filename?: string } | undefined;
  return p ?? {};
}

function mcuObjectNames(objects: string[]): string[] {
  return objects.filter((o) => o === "mcu" || o.startsWith("mcu "));
}

function readMcuVersion(obj: Record<string, unknown> | undefined): string | undefined {
  if (!obj) {
    return undefined;
  }
  const v = obj.mcu_version;
  return typeof v === "string" ? v : undefined;
}

export async function buildPrinterSnapshot(
  baseUrl: string,
  displayHostnameFallback: string,
  apiKey?: string,
): Promise<PrinterSnapshot> {
  const normalized = normalizeBaseUrl(baseUrl);
  let server: MoonrakerServerInfo | undefined;
  let webhooks_state: string | undefined;
  let print_stats: { state?: string; filename?: string } = {};
  let uptimeSec: number | null = null;
  let hostname = displayHostnameFallback;
  let klipperHostVersion = "—";
  let printerInfo: PrinterSnapshot["printerInfo"];
  const mcuVersions: McuVersionRow[] = [];

  const serverOutcome = await fetchServerInfoOutcome(normalized, apiKey);
  if (!serverOutcome.ok) {
    let offlineDetail: PrinterSnapshot["offlineDetail"];
    let httpStatus: number | undefined;
    if (serverOutcome.kind === "network") {
      offlineDetail = "unreachable";
    } else if (serverOutcome.status === 401 || serverOutcome.status === 403) {
      offlineDetail = "auth";
      httpStatus = serverOutcome.status;
    } else {
      offlineDetail = "http";
      httpStatus = serverOutcome.status;
    }
    return {
      status: "offline",
      hostname: displayHostnameFallback,
      moonrakerVersion: "—",
      klipperHostVersion: "—",
      mcuVersions: [],
      uptimeSec: null,
      printFilename: null,
      isActivelyPrinting: false,
      isIdleReady: false,
      offlineDetail,
      httpStatus,
      raw: {},
    };
  }
  server = serverOutcome.data;

  const [procResult, listResult, infoResult] = await Promise.allSettled([
    fetchProcStats(normalized, apiKey),
    fetchObjectsList(normalized, apiKey),
    fetchPrinterInfo(normalized, apiKey),
  ]);

  if (procResult.status === "fulfilled" && procResult.value.system_uptime != null) {
    uptimeSec = procResult.value.system_uptime;
  }

  if (infoResult.status === "fulfilled") {
    const pi = infoResult.value;
    hostname = pi.hostname || hostname;
    klipperHostVersion = pi.software_version || "—";
    printerInfo = { state: pi.state, state_message: pi.state_message };
  }

  const mcuNames =
    listResult.status === "fulfilled" ? mcuObjectNames(listResult.value.objects) : ["mcu"];

  const queryPayload: Record<string, string[] | null> = {
    webhooks: null,
    print_stats: null,
  };
  for (const name of mcuNames) {
    queryPayload[name] = ["mcu_version"];
  }

  try {
    const queried = await fetchObjectsQuery(normalized, queryPayload, apiKey);
    const st = queried.status;
    webhooks_state = pickWebhookState(st);
    print_stats = pickPrintStats(st);
    for (const name of mcuNames) {
      const ver = readMcuVersion(st[name]);
      if (ver) {
        mcuVersions.push({ name: name === "mcu" ? "mcu" : name.replace(/^mcu /, ""), version: ver });
      }
    }
  } catch {
    webhooks_state = undefined;
  }

  const status = deriveCardStatus({
    fetchFailed: false,
    klippy_connected: server?.klippy_connected,
    klippy_state: server?.klippy_state,
    webhooks_state,
    print_stats_state: print_stats.state,
  });

  const ps = print_stats.state;
  const isActivelyPrinting = ps === "printing" || ps === "paused";
  const isIdleReady =
    status !== "offline" &&
    status !== "error" &&
    !isActivelyPrinting &&
    webhooks_state === "ready" &&
    server?.klippy_state === "ready";

  return {
    status,
    hostname,
    moonrakerVersion: server?.moonraker_version ?? "—",
    klipperHostVersion,
    mcuVersions,
    uptimeSec,
    printFilename: print_stats.filename && print_stats.filename.length > 0 ? print_stats.filename : null,
    isActivelyPrinting,
    isIdleReady,
    printerInfo,
    raw: { server, webhooks_state, print_stats },
  };
}

