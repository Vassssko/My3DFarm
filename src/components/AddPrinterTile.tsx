import { motion } from "framer-motion";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { isTauri } from "../lib/isTauri";
import type { DiscoveryRow } from "../hooks/useMoonrakerDiscoveryScan";
import { useMoonrakerDiscoveryScan } from "../hooks/useMoonrakerDiscoveryScan";
import { normalizeBaseUrl, probeMoonraker } from "../moonraker/client";
import { sanitizeNetworkPrefixesInput } from "../lib/sanitizeNetworkPrefixInput";
import { farmPrioritySubnetPrefixes } from "../moonraker/discoveryPrefixes";
import { usePrinterStore } from "../store/printerStore";

type Mode = "search" | "direct";

export function AddPrinterTile() {
  const { t } = useTranslation();
  const printers = usePrinterStore((s) => s.printers);
  const addPrinters = usePrinterStore((s) => s.addPrinters);
  const [mode, setMode] = useState<Mode>("search");
  const [networkPrefixesInput, setNetworkPrefixesInput] = useState("");
  const [directUrl, setDirectUrl] = useState("");
  const [directBusy, setDirectBusy] = useState(false);
  const [directError, setDirectError] = useState<string | null>(null);

  const existingNormalized = useMemo(
    () => new Set(printers.map((p) => normalizeBaseUrl(p.baseUrl))),
    [printers],
  );

  const farmScanPriorityPrefixes = useMemo(
    () => farmPrioritySubnetPrefixes(printers.map((p) => p.baseUrl)),
    [printers],
  );

  const resolveExclude = useCallback(
    () => new Set(usePrinterStore.getState().printers.map((p) => normalizeBaseUrl(p.baseUrl))),
    [],
  );

  const appendOneHost = useCallback(
    (row: DiscoveryRow) => {
      addPrinters([
        {
          baseUrl: row.baseUrl,
          apiKey: row.apiKeyDraft.trim() || undefined,
          displayName: row.label,
        },
      ]);
    },
    [addPrinters],
  );

  const { searching, error, progress, probe, runSearch, stopDiscovery } = useMoonrakerDiscoveryScan(t);

  const runNetworkSearch = useCallback(() => {
    void runSearch(networkPrefixesInput, {
      priorityNetworkPrefixes: farmScanPriorityPrefixes,
      resolveExclude,
      onHostProbed: appendOneHost,
    });
  }, [runSearch, networkPrefixesInput, farmScanPriorityPrefixes, resolveExclude, appendOneHost]);

  const probeDirect = useCallback(async () => {
    setDirectError(null);
    const raw = directUrl.trim();
    if (!raw) {
      setDirectError(t("printer.directUrlInvalid"));
      return;
    }
    let base: string;
    try {
      base = normalizeBaseUrl(raw.startsWith("http") ? raw : `http://${raw}`);
    } catch {
      setDirectError(t("printer.directUrlInvalid"));
      return;
    }
    if (existingNormalized.has(base)) {
      setDirectError(t("printer.alreadyInFarm"));
      return;
    }
    setDirectBusy(true);
    try {
      const status = await probeMoonraker(base, undefined);
      if (status === 0) {
        setDirectError(t("printer.directProbeFailed"));
        return;
      }
      if (status !== 200 && status !== 401 && status !== 403) {
        setDirectError(t("printer.offlineHttpHint", { status }));
        return;
      }
      const label = (() => {
        try {
          return new URL(base).hostname;
        } catch {
          return base;
        }
      })();
      addPrinters([{ baseUrl: base, displayName: label }]);
      setDirectUrl("");
      setDirectError(null);
    } catch (e) {
      const detail = e instanceof Error ? e.message : String(e);
      setDirectError(detail || t("printer.directProbeFailed"));
    } finally {
      setDirectBusy(false);
    }
  }, [directUrl, existingNormalized, addPrinters, t]);

  const showSearchProgressBar = mode === "search" && searching;
  let barPercent = 0;
  let barIndeterminate = false;
  if (showSearchProgressBar) {
    if (probe && probe.total > 0) {
      barPercent = Math.min(100, Math.round((probe.index / probe.total) * 100));
    } else if (progress && progress.total > 0) {
      barPercent = Math.min(100, Math.round((progress.scanned / progress.total) * 100));
    } else {
      barIndeterminate =
        !progress ||
        (progress.phase !== "stopped" &&
          progress.phase !== "done" &&
          (progress.phase === "mdns" ||
            (progress.total === 0 && progress.phase !== "mdns_done")));
    }
  }

  const scanHostLine =
    probe && probe.total > 0
      ? probe.host
      : progress?.current
        ? progress.current
        : null;

  const showScanStatus =
    mode === "search" && (searching || probe !== null || progress !== null);

  const scanStatusSecondary =
    probe && probe.total > 0
      ? t("discovery.probeProgressShort", {
          index: probe.index,
          total: probe.total,
        })
      : progress && progress.total > 0
        ? t("discovery.addressesProgress", {
            scanned: progress.scanned,
            total: progress.total,
          })
        : progress
          ? t(`discovery.phase.${progress.phase}`, progress.phase)
          : searching
            ? t("discovery.searching")
            : null;

  const scanLineOne =
    scanHostLine && scanStatusSecondary
      ? `${scanHostLine} · ${scanStatusSecondary}`
      : scanHostLine ?? scanStatusSecondary;

  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      className="glass glass-interactive relative flex h-full min-h-0 flex-col overflow-hidden rounded-xl"
      initial={{ opacity: 0, y: 6 }}
      transition={{ duration: 0.22 }}
    >
      <div
        className={`flex min-h-0 flex-1 flex-col ${showSearchProgressBar ? "p-2 pb-2.5" : "p-2"}`}
      >
        <p className="text-[10px] font-semibold leading-tight text-[var(--text-primary)]">
          {t("printer.addPrinterTile")}
        </p>

        <div className="mt-1 flex gap-0.5 rounded-md bg-black/5 p-0.5 dark:bg-white/10">
          <button
            className={`flex-1 rounded px-1.5 py-0.5 text-[9px] font-medium transition-colors ${
              mode === "search"
                ? "bg-[var(--glass-bg)] text-[var(--text-primary)] shadow-sm"
                : "text-[var(--text-secondary)]"
            }`}
            onClick={() => setMode("search")}
            type="button"
          >
            {t("discovery.networkSearch")}
          </button>
          <button
            className={`flex-1 rounded px-1.5 py-0.5 text-[9px] font-medium transition-colors ${
              mode === "direct"
                ? "bg-[var(--glass-bg)] text-[var(--text-primary)] shadow-sm"
                : "text-[var(--text-secondary)]"
            }`}
            onClick={() => setMode("direct")}
            type="button"
          >
            {t("printer.directUrl")}
          </button>
        </div>

        {mode === "search" ? (
          <div className="mt-1.5 flex min-h-0 flex-1 flex-col gap-1">
            <div className="flex items-center gap-1">
              <input
                autoComplete="off"
                className="h-7 min-w-0 flex-1 rounded-md border border-[var(--glass-border)] bg-white/50 px-2 font-mono text-[10px] text-[var(--text-primary)] outline-none focus:ring-1 focus:ring-[var(--accent)] dark:bg-black/30"
                disabled={searching}
                onChange={(e) =>
                  setNetworkPrefixesInput(sanitizeNetworkPrefixesInput(e.target.value))
                }
                placeholder={t("discovery.networkPlaceholder")}
                title={t("discovery.networkHint")}
                type="text"
                value={networkPrefixesInput}
              />
              <button
                className="h-7 shrink-0 rounded-md bg-[var(--accent)] px-2.5 text-[9px] font-medium text-white disabled:opacity-50"
                disabled={searching}
                onClick={runNetworkSearch}
                type="button"
              >
                {searching ? t("discovery.searching") : t("discovery.search")}
              </button>
              {searching && isTauri() ? (
                <button
                  className="h-7 shrink-0 rounded-md border border-[var(--warning)]/50 px-2 text-[9px] text-[var(--warning)]"
                  onClick={stopDiscovery}
                  type="button"
                >
                  {t("discovery.stop")}
                </button>
              ) : null}
            </div>
            {showScanStatus && scanLineOne ? (
              <p
                className="truncate font-mono text-[8px] leading-snug text-[var(--text-primary)]"
                title={scanLineOne}
              >
                {scanLineOne}
              </p>
            ) : null}
            {error ? <p className="text-[8px] text-[var(--warning)]">{error}</p> : null}
            <div className="min-h-0 flex-1" />
          </div>
        ) : (
          <div className="mt-1.5 flex min-h-0 flex-1 flex-col gap-1">
            <div className="flex items-center gap-1">
              <input
                autoComplete="off"
                className="h-7 min-w-0 flex-1 rounded-md border border-[var(--glass-border)] bg-white/50 px-2 font-mono text-[10px] text-[var(--text-primary)] outline-none focus:ring-1 focus:ring-[var(--accent)] dark:bg-black/30"
                disabled={directBusy}
                onChange={(e) => setDirectUrl(e.target.value)}
                placeholder={t("printer.directUrlPlaceholder")}
                type="text"
                value={directUrl}
              />
              <button
                className="h-7 shrink-0 rounded-md bg-[var(--accent)] px-2.5 text-[9px] font-medium text-white disabled:opacity-50"
                disabled={directBusy}
                onClick={() => void probeDirect()}
                type="button"
              >
                {directBusy ? t("discovery.searching") : t("printer.directUrlAdd")}
              </button>
            </div>
            {directError ? <p className="text-[8px] text-[var(--warning)]">{directError}</p> : null}
            <div className="min-h-0 flex-1" />
          </div>
        )}
      </div>

      {showSearchProgressBar ? (
        <div
          aria-hidden
          className="absolute bottom-0 left-0 right-0 h-[2px] bg-black/15 dark:bg-white/15"
        >
          {barIndeterminate ? (
            <div className="h-full w-full animate-pulse bg-[var(--success)]/85" />
          ) : (
            <motion.div
              animate={{ width: `${barPercent}%` }}
              className="h-full bg-[var(--success)]"
              initial={{ width: 0 }}
              transition={{ duration: 0.2 }}
            />
          )}
        </div>
      ) : null}
    </motion.div>
  );
}
