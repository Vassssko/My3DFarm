import { pushDebugEvent } from "../lib/debugRingBuffer";
import { isTauri } from "../lib/isTauri";
import type {
  MoonrakerObjectsList,
  MoonrakerObjectsQueryResult,
  MoonrakerPrinterInfo,
  MoonrakerProcStats,
  MoonrakerServerInfo,
} from "./types";

/** Farm / Wi‑Fi Pis often need more time; parallel cards multiply load on each host. */
export const MOONRAKER_FETCH_TIMEOUT_MS = 10_000;

const MOONRAKER_MAX_PARALLEL = 12;
let moonrakerSlotsInUse = 0;
const moonrakerSlotWaiters: Array<() => void> = [];

async function takeMoonrakerSlot(): Promise<void> {
  if (moonrakerSlotsInUse < MOONRAKER_MAX_PARALLEL) {
    moonrakerSlotsInUse++;
    return;
  }
  await new Promise<void>((resolve) => {
    moonrakerSlotWaiters.push(() => {
      moonrakerSlotsInUse++;
      resolve();
    });
  });
}

function releaseMoonrakerSlot(): void {
  moonrakerSlotsInUse--;
  const next = moonrakerSlotWaiters.shift();
  if (next) {
    next();
  }
}

/**
 * Moonraker HTTP API wraps payloads in `{ "result": T }` (same style as JSON-RPC).
 * Older instances or mocks may return a flat body; support both.
 */
export function unwrapMoonrakerJson<T>(parsed: unknown): T {
  if (parsed !== null && typeof parsed === "object" && "result" in parsed) {
    return (parsed as { result: T }).result;
  }
  return parsed as T;
}

async function readMoonrakerBody<T>(r: Response): Promise<T> {
  const parsed: unknown = await r.json();
  return unwrapMoonrakerJson<T>(parsed);
}

function buildHeaders(apiKey?: string, extra?: Record<string, string>): Record<string, string> {
  const h: Record<string, string> = { Accept: "application/json", ...extra };
  if (apiKey) {
    h["X-Api-Key"] = apiKey;
  }
  return h;
}

export function normalizeBaseUrl(url: string): string {
  const u = url.trim().replace(/\/+$/, "");
  return u || url;
}

async function moonrakerFetchViaRust(
  fullUrl: string,
  opts: {
    apiKey?: string;
    method?: string;
    body?: string;
  },
): Promise<Response> {
  const { invoke } = await import("@tauri-apps/api/core");
  const out = await invoke<{ status: number; body: string }>("moonraker_proxy_request", {
    req: {
      method: opts.method ?? "GET",
      url: fullUrl,
      body: opts.body,
      apiKey: opts.apiKey,
      timeoutMs: MOONRAKER_FETCH_TIMEOUT_MS,
    },
  });
  return new Response(out.body, {
    status: out.status,
    headers: { "Content-Type": "application/json" },
  });
}

async function moonrakerFetch(
  baseUrl: string,
  path: string,
  opts: {
    apiKey?: string;
    method?: string;
    body?: string;
    extraHeaders?: Record<string, string>;
  } = {},
): Promise<Response> {
  await takeMoonrakerSlot();
  const url = `${normalizeBaseUrl(baseUrl)}${path.startsWith("/") ? path : `/${path}`}`;
  const method = opts.method ?? "GET";
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), MOONRAKER_FETCH_TIMEOUT_MS);
  try {
    if (isTauri()) {
      if (opts.extraHeaders && Object.keys(opts.extraHeaders).length > 0) {
        console.warn(
          "[Moonraker] Дополнительные заголовки в Tauri не проксируются; только X-Api-Key и тело JSON.",
        );
      }
      return await moonrakerFetchViaRust(url, {
        apiKey: opts.apiKey,
        method,
        body: opts.body,
      });
    }
    return await fetch(url, {
      method,
      headers: buildHeaders(opts.apiKey, opts.extraHeaders),
      body: opts.body,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(id);
    releaseMoonrakerSlot();
  }
}

export type MoonrakerServerInfoOutcome =
  | { ok: true; data: MoonrakerServerInfo }
  | { ok: false; kind: "http"; status: number }
  | { ok: false; kind: "network" };

/** Same as GET /server/info but never throws; use for diagnostics (401 vs timeout). */
export async function fetchServerInfoOutcome(
  baseUrl: string,
  apiKey?: string,
): Promise<MoonrakerServerInfoOutcome> {
  const infoUrl = `${normalizeBaseUrl(baseUrl)}/server/info`;
  try {
    const r = await moonrakerFetch(baseUrl, "/server/info", { apiKey });
    if (!r.ok) {
      pushDebugEvent({
        kind: "moonraker.server_info",
        message: `HTTP ${r.status}`,
        detail: { url: infoUrl },
      });
      return { ok: false, kind: "http", status: r.status };
    }
    try {
      const data = await readMoonrakerBody<MoonrakerServerInfo>(r);
      return { ok: true, data };
    } catch (e) {
      pushDebugEvent({
        kind: "moonraker.server_info",
        message: "JSON parse / unwrap failed",
        detail: { url: infoUrl, error: e instanceof Error ? e.message : String(e) },
      });
      return { ok: false, kind: "network" };
    }
  } catch (e) {
    pushDebugEvent({
      kind: "moonraker.server_info",
      message: "fetch / invoke failed",
      detail: { url: infoUrl, error: e instanceof Error ? e.message : String(e) },
    });
    return { ok: false, kind: "network" };
  }
}

export async function fetchServerInfo(
  baseUrl: string,
  apiKey?: string,
): Promise<MoonrakerServerInfo> {
  const o = await fetchServerInfoOutcome(baseUrl, apiKey);
  if (!o.ok) {
    throw new Error(o.kind === "http" ? `server/info ${o.status}` : "server/info network");
  }
  return o.data;
}

export async function fetchProcStats(
  baseUrl: string,
  apiKey?: string,
): Promise<MoonrakerProcStats> {
  const r = await moonrakerFetch(baseUrl, "/machine/proc_stats", { apiKey: apiKey });
  if (!r.ok) {
    throw new Error(`proc_stats ${r.status}`);
  }
  return readMoonrakerBody<MoonrakerProcStats>(r);
}

export async function fetchPrinterInfo(
  baseUrl: string,
  apiKey?: string,
): Promise<MoonrakerPrinterInfo> {
  const r = await moonrakerFetch(baseUrl, "/printer/info", { apiKey: apiKey });
  if (!r.ok) {
    throw new Error(`printer/info ${r.status}`);
  }
  return readMoonrakerBody<MoonrakerPrinterInfo>(r);
}

export async function fetchObjectsList(
  baseUrl: string,
  apiKey?: string,
): Promise<MoonrakerObjectsList> {
  const r = await moonrakerFetch(baseUrl, "/printer/objects/list", { apiKey: apiKey });
  if (!r.ok) {
    throw new Error(`objects/list ${r.status}`);
  }
  return readMoonrakerBody<MoonrakerObjectsList>(r);
}

export async function fetchObjectsQuery(
  baseUrl: string,
  objects: Record<string, string[] | null>,
  apiKey?: string,
): Promise<MoonrakerObjectsQueryResult> {
  const r = await moonrakerFetch(baseUrl, "/printer/objects/query", {
    apiKey,
    method: "POST",
    extraHeaders: { "Content-Type": "application/json" },
    body: JSON.stringify({ objects }),
  });
  if (!r.ok) {
    throw new Error(`objects/query ${r.status}`);
  }
  return readMoonrakerBody<MoonrakerObjectsQueryResult>(r);
}

/** Probe Moonraker; returns status code (200/401/…) without throwing on HTTP errors. */
export async function probeMoonraker(
  baseUrl: string,
  apiKey?: string,
  externalSignal?: AbortSignal,
): Promise<number> {
  const url = `${normalizeBaseUrl(baseUrl)}/server/info`;
  if (isTauri()) {
    if (externalSignal?.aborted) {
      return 0;
    }
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const out = await invoke<{ status: number; body: string }>("moonraker_proxy_request", {
        req: {
          method: "GET",
          url,
          apiKey,
          timeoutMs: MOONRAKER_FETCH_TIMEOUT_MS,
        },
      });
      return out.status;
    } catch (e) {
      pushDebugEvent({
        kind: "moonraker.probe",
        message: "Tauri proxy failed",
        detail: { url, error: e instanceof Error ? e.message : String(e) },
      });
      return 0;
    }
  }
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), MOONRAKER_FETCH_TIMEOUT_MS);
  const onExternalAbort = () => controller.abort();
  externalSignal?.addEventListener("abort", onExternalAbort);
  try {
    const r = await fetch(url, {
      method: "GET",
      headers: buildHeaders(apiKey),
      signal: controller.signal,
    });
    return r.status;
  } catch (e) {
    pushDebugEvent({
      kind: "moonraker.probe",
      message: "fetch failed",
      detail: { url, error: e instanceof Error ? e.message : String(e) },
    });
    return 0;
  } finally {
    clearTimeout(tid);
    externalSignal?.removeEventListener("abort", onExternalAbort);
  }
}
