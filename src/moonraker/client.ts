import { pushDebugEvent } from "../lib/debugRingBuffer";
import { isTauri } from "../lib/isTauri";
import type {
  MoonrakerFileListEntry,
  MoonrakerHistoryListResponse,
  MoonrakerMachineSystemInfo,
  MoonrakerMachineUpdateStatus,
  MoonrakerObjectsList,
  MoonrakerObjectsQueryResult,
  MoonrakerPrinterInfo,
  MoonrakerProcStats,
  MoonrakerServerInfo,
} from "./types";

/** Farm / Wi‑Fi Pis often need more time; parallel cards multiply load on each host. */
export const MOONRAKER_FETCH_TIMEOUT_MS = 10_000;

/** Moonraker POST /machine/update/refresh|upgrade can run git fetch and package scans for a long time. */
export const MOONRAKER_UPDATE_MUTATION_TIMEOUT_MS = 180_000;

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
    timeoutMs?: number;
  },
): Promise<Response> {
  const { invoke } = await import("@tauri-apps/api/core");
  const timeoutMs = opts.timeoutMs ?? MOONRAKER_FETCH_TIMEOUT_MS;
  const out = await invoke<{ status: number; body: string }>("moonraker_proxy_request", {
    req: {
      method: opts.method ?? "GET",
      url: fullUrl,
      body: opts.body,
      apiKey: opts.apiKey,
      timeoutMs,
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
    /** Override default 10s (e.g. long-running update manager calls). */
    timeoutMs?: number;
  } = {},
): Promise<Response> {
  await takeMoonrakerSlot();
  const url = `${normalizeBaseUrl(baseUrl)}${path.startsWith("/") ? path : `/${path}`}`;
  const method = opts.method ?? "GET";
  const timeoutMs = opts.timeoutMs ?? MOONRAKER_FETCH_TIMEOUT_MS;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
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
        timeoutMs,
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

/** Moonraker GET /server/history/list — newest jobs first when order=desc. */
export async function fetchHistoryList(
  baseUrl: string,
  apiKey?: string,
  opts?: { limit?: number },
): Promise<MoonrakerHistoryListResponse> {
  const limit = opts?.limit ?? 30;
  const q = new URLSearchParams({ limit: String(limit), order: "desc" });
  const r = await moonrakerFetch(baseUrl, `/server/history/list?${q.toString()}`, { apiKey });
  if (!r.ok) {
    throw new Error(`history/list ${r.status}`);
  }
  return readMoonrakerBody<MoonrakerHistoryListResponse>(r);
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

export async function fetchMachineSystemInfo(
  baseUrl: string,
  apiKey?: string,
): Promise<MoonrakerMachineSystemInfo> {
  const r = await moonrakerFetch(baseUrl, "/machine/system_info", { apiKey });
  if (!r.ok) {
    throw new Error(`system_info ${r.status}`);
  }
  return readMoonrakerBody<MoonrakerMachineSystemInfo>(r);
}

export async function fetchMachineUpdateStatus(
  baseUrl: string,
  apiKey?: string,
): Promise<MoonrakerMachineUpdateStatus> {
  const r = await moonrakerFetch(baseUrl, "/machine/update/status", { apiKey });
  if (!r.ok) {
    throw new Error(`update/status ${r.status}`);
  }
  return readMoonrakerBody<MoonrakerMachineUpdateStatus>(r);
}

/** POST /machine/update/refresh — CPU-heavy; call when the user asks to refresh. */
export async function postMachineUpdateRefresh(
  baseUrl: string,
  apiKey?: string,
  name?: string | null,
): Promise<MoonrakerMachineUpdateStatus> {
  const body =
    name === undefined || name === null || name === ""
      ? JSON.stringify({})
      : JSON.stringify({ name });
  const r = await moonrakerFetch(baseUrl, "/machine/update/refresh", {
    apiKey,
    method: "POST",
    body,
    extraHeaders: { "Content-Type": "application/json" },
    timeoutMs: MOONRAKER_UPDATE_MUTATION_TIMEOUT_MS,
  });
  if (!r.ok) {
    throw new Error(`update/refresh ${r.status}`);
  }
  return readMoonrakerBody<MoonrakerMachineUpdateStatus>(r);
}

/** POST /machine/update/upgrade — omit `name` to upgrade all registered items (Moonraker order). */
export async function postMachineUpdateUpgrade(
  baseUrl: string,
  apiKey?: string,
  name?: string,
): Promise<void> {
  const body = JSON.stringify(name ? { name } : {});
  const r = await moonrakerFetch(baseUrl, "/machine/update/upgrade", {
    apiKey,
    method: "POST",
    body,
    extraHeaders: { "Content-Type": "application/json" },
    timeoutMs: MOONRAKER_UPDATE_MUTATION_TIMEOUT_MS,
  });
  if (!r.ok) {
    const errText = await r.text().catch(() => "");
    throw new Error(`update/upgrade ${r.status}${errText ? `: ${errText.slice(0, 240)}` : ""}`);
  }
}

export async function fetchServerFilesList(
  baseUrl: string,
  root: string,
  apiKey?: string,
): Promise<MoonrakerFileListEntry[]> {
  const r = await moonrakerFetch(
    baseUrl,
    `/server/files/list?${new URLSearchParams({ root }).toString()}`,
    { apiKey },
  );
  if (!r.ok) {
    throw new Error(`files/list ${r.status}`);
  }
  const body = await readMoonrakerBody<{ dirs?: MoonrakerFileListEntry[]; files?: MoonrakerFileListEntry[] }>(
    r,
  );
  const files = body.files ?? [];
  const dirs = body.dirs ?? [];
  return [...dirs, ...files];
}

/** Moonraker `logs` root → `klippy.log` via HTTP (may be denied by moonraker.conf). */
export async function tryFetchKlippyLogTail(
  baseUrl: string,
  apiKey?: string,
  maxBytes = 900_000,
): Promise<string | null> {
  try {
    const list = await fetchServerFilesList(baseUrl, "logs", apiKey);
    const hit = list.find((e) => {
      const n = `${e.filename ?? ""} ${e.path ?? ""}`.toLowerCase();
      return n.includes("klippy");
    });
    const rel =
      (typeof hit?.path === "string" && hit.path) ||
      (typeof hit?.filename === "string" ? `logs/${hit.filename}` : null);
    if (!rel) {
      return null;
    }
    const pathEnc = encodeURIComponent(rel.replace(/^\//, ""));
    const r = await moonrakerFetch(baseUrl, `/server/files/path?path=${pathEnc}`, { apiKey });
    if (!r.ok) {
      return null;
    }
    const text = await r.text();
    if (!text || text.length < 20) {
      return null;
    }
    return text.length > maxBytes ? text.slice(-maxBytes) : text;
  } catch {
    return null;
  }
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
