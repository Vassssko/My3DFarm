import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useCallback, useEffect, useRef, useState } from "react";
import type { TFunction } from "i18next";
import { isTauri } from "../lib/isTauri";
import { normalizeBaseUrl, probeMoonraker } from "../moonraker/client";

export type RustDiscovered = {
  baseUrl: string;
  label: string;
  sources: string[];
};

export type DiscoveryRow = RustDiscovered & {
  needsApiKey: boolean;
  apiKeyDraft: string;
};

export type DiscoveryProgressPayload = {
  phase: string;
  message: string;
  scanned: number;
  total: number;
  current: string | null;
  foundMoonraker: number;
};

export type DiscoveryLogPayload = {
  level: string;
  message: string;
};

export type ProbeState = {
  index: number;
  total: number;
  host: string;
};

export function networkPrefixesFromInput(raw: string): string[] {
  return raw
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export type RunDiscoveryOptions = {
  /** Static exclude set (optional if resolveExclude is set). */
  excludeNormalizedBaseUrls?: Set<string>;
  /** Fresh exclude set each check (e.g. from Zustand). */
  resolveExclude?: () => Set<string>;
  priorityNetworkPrefixes?: string[];
  /** Called after each host is probed (also for streaming candidates from the app). */
  onHostProbed?: (row: DiscoveryRow) => void;
};

function mergedExclude(options?: RunDiscoveryOptions): Set<string> | undefined {
  const a = options?.resolveExclude?.();
  const b = options?.excludeNormalizedBaseUrls;
  if (a && b) {
    return new Set([...a, ...b]);
  }
  return a ?? b;
}

export function useMoonrakerDiscoveryScan(t: TFunction) {
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<DiscoveryProgressPayload | null>(null);
  const [logs, setLogs] = useState<DiscoveryLogPayload[]>([]);
  const [probe, setProbe] = useState<ProbeState | null>(null);
  const unsubsRef = useRef<Array<() => void>>([]);
  const discoveryAbortRef = useRef<AbortController | null>(null);
  const discoverySessionRef = useRef(0);

  const clearListeners = useCallback(() => {
    for (const u of unsubsRef.current) {
      try {
        u();
      } catch {
        /* ignore */
      }
    }
    unsubsRef.current = [];
  }, []);

  useEffect(() => {
    return () => clearListeners();
  }, [clearListeners]);

  const stopDiscovery = useCallback(() => {
    discoveryAbortRef.current?.abort();
    if (isTauri()) {
      void invoke("stop_discovery_scan").catch(() => {
        /* ignore */
      });
    }
  }, []);

  const runSearch = useCallback(
    async (networkPrefixesInput: string, options?: RunDiscoveryOptions) => {
      discoveryAbortRef.current = new AbortController();
      const runSignal = discoveryAbortRef.current.signal;
      const sessionId = ++discoverySessionRef.current;
      const handledBases = new Set<string>();

      setSearching(true);
      setError(null);
      setProgress({
        phase: "starting",
        message: "starting",
        scanned: 0,
        total: 0,
        current: null,
        foundMoonraker: 0,
      });
      setLogs([]);
      setProbe(null);
      clearListeners();

      const probeAndEmit = async (h: RustDiscovered) => {
        if (sessionId !== discoverySessionRef.current) {
          return;
        }
        const base = normalizeBaseUrl(h.baseUrl);
        if (handledBases.has(base)) {
          return;
        }
        const ex = mergedExclude(options);
        if (ex?.has(base)) {
          return;
        }
        handledBases.add(base);

        const status = await probeMoonraker(base, undefined, runSignal);
        if (sessionId !== discoverySessionRef.current || runSignal.aborted) {
          return;
        }
        const needsApiKey = status === 401 || status === 403;
        const row: DiscoveryRow = { ...h, baseUrl: base, needsApiKey, apiKeyDraft: "" };
        options?.onHostProbed?.(row);
      };

      if (isTauri()) {
        const u1 = await listen<DiscoveryProgressPayload>("discovery-progress", (e) => {
          setProgress(e.payload);
        });
        const u2 = await listen<DiscoveryLogPayload>("discovery-log", (e) => {
          setLogs((prev) => [...prev.slice(-32), e.payload]);
        });
        const u3 = await listen<RustDiscovered>("discovery-candidate", (e) => {
          void probeAndEmit(e.payload);
        });
        unsubsRef.current.push(u1, u2, u3);
      }

      try {
        let list: RustDiscovered[] = [];
        if (isTauri()) {
          const networkPrefixes = networkPrefixesFromInput(networkPrefixesInput);
          list = await invoke<RustDiscovered[]>("discover_moonraker_hosts", {
            input: {
              networkPrefixes,
              priorityNetworkPrefixes: options?.priorityNetworkPrefixes ?? [],
            },
          });
        } else {
          setLogs((prev) => [
            ...prev,
            { level: "warn", message: t("discovery.webNoScan") },
          ]);
        }

        if (sessionId !== discoverySessionRef.current) {
          return;
        }

        const n = list.length;
        for (let i = 0; i < n; i++) {
          if (runSignal.aborted) {
            break;
          }
          const h = list[i];
          const base = normalizeBaseUrl(h.baseUrl);
          if (handledBases.has(base)) {
            continue;
          }
          const ex = mergedExclude(options);
          if (ex?.has(base)) {
            continue;
          }

          handledBases.add(base);

          setProbe({
            index: i + 1,
            total: n,
            host: base,
          });

          const status = await probeMoonraker(base, undefined, runSignal);
          if (sessionId !== discoverySessionRef.current || runSignal.aborted) {
            break;
          }
          const needsApiKey = status === 401 || status === 403;
          const row: DiscoveryRow = { ...h, baseUrl: base, needsApiKey, apiKeyDraft: "" };
          options?.onHostProbed?.(row);
        }
      } catch (e) {
        console.error(e);
        const detail = e instanceof Error ? e.message : String(e);
        if (detail.includes("invalidPrefix")) {
          setError(t("discovery.networkInvalid"));
        } else {
          setError(`${t("errors.discoveryFailed")}${detail ? `: ${detail}` : ""}`);
        }
      } finally {
        clearListeners();
        discoveryAbortRef.current = null;
        setSearching(false);
        setProbe(null);
        setProgress(null);
      }
    },
    [clearListeners, t],
  );

  return {
    searching,
    error,
    setError,
    progress,
    logs,
    probe,
    runSearch,
    stopDiscovery,
  };
}
