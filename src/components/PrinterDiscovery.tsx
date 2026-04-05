import { motion } from "framer-motion";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { isTauri } from "../lib/isTauri";
import type { DiscoveryRow } from "../hooks/useMoonrakerDiscoveryScan";
import { useMoonrakerDiscoveryScan } from "../hooks/useMoonrakerDiscoveryScan";
import { sanitizeNetworkPrefixesInput } from "../lib/sanitizeNetworkPrefixInput";
import { normalizeBaseUrl } from "../moonraker/client";
import { farmPrioritySubnetPrefixes } from "../moonraker/discoveryPrefixes";
import { usePrinterStore } from "../store/printerStore";

function phaseLabelKey(phase: string): string {
  return `discovery.phase.${phase}`;
}

export function PrinterDiscovery({ compactTop }: { compactTop?: boolean }) {
  const { t } = useTranslation();
  const printers = usePrinterStore((s) => s.printers);
  const addPrinters = usePrinterStore((s) => s.addPrinters);
  const [networkPrefixesInput, setNetworkPrefixesInput] = useState("");
  const { searching, error, progress, logs, probe, runSearch, stopDiscovery } =
    useMoonrakerDiscoveryScan(t);

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

  const farmScanPriorityPrefixes = useMemo(
    () => farmPrioritySubnetPrefixes(printers.map((p) => p.baseUrl)),
    [printers],
  );

  const showProgressPanel = searching || progress !== null || logs.length > 0 || probe !== null;

  const barPercent =
    progress && progress.total > 0
      ? Math.min(100, Math.round((progress.scanned / progress.total) * 100))
      : 0;
  const indeterminate =
    progress &&
    progress.phase !== "stopped" &&
    progress.phase !== "done" &&
    (progress.phase === "mdns" ||
      (progress.total === 0 && progress.phase !== "mdns_done"));

  return (
    <div
      className={
        compactTop
          ? "flex h-full min-h-0 flex-col overflow-hidden p-6"
          : "flex h-full min-h-0 flex-col overflow-hidden px-6 pb-6 pt-4"
      }
    >
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className="glass glass-interactive mx-auto flex h-full min-h-0 w-full max-w-lg flex-col overflow-hidden p-8"
        initial={{ opacity: 0, y: 10 }}
        transition={{ duration: 0.3 }}
      >
        <div className="min-w-0 shrink-0">
          <h1 className="text-xl font-semibold tracking-tight text-[var(--text-primary)]">
            {t("discovery.title")}
          </h1>
          <div className="mt-5">
            <label
              className="text-xs font-medium text-[var(--text-secondary)]"
              htmlFor="discovery-network-prefixes"
            >
              {t("discovery.networkLabel")}
            </label>
            <textarea
              className="mt-1.5 max-h-32 w-full resize-y rounded-xl border border-[var(--glass-border)] bg-white/50 px-3 py-2 font-mono text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-secondary)]/70 focus:ring-2 focus:ring-[var(--accent)] dark:bg-black/30"
              disabled={searching}
              id="discovery-network-prefixes"
              onChange={(e) =>
                setNetworkPrefixesInput(sanitizeNetworkPrefixesInput(e.target.value))
              }
              placeholder={t("discovery.networkPlaceholder")}
              rows={2}
              value={networkPrefixesInput}
            />
            <p className="mt-1.5 text-xs text-[var(--text-secondary)]">{t("discovery.networkHint")}</p>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              className="rounded-xl bg-[var(--accent)] px-5 py-2.5 text-sm font-medium text-white shadow-md transition-all duration-300 hover:opacity-90 disabled:opacity-50"
              disabled={searching}
              onClick={() =>
                void runSearch(networkPrefixesInput, {
                  priorityNetworkPrefixes: farmScanPriorityPrefixes,
                  resolveExclude,
                  onHostProbed: appendOneHost,
                })
              }
              type="button"
            >
              {searching ? t("discovery.searching") : t("discovery.search")}
            </button>
            {searching && isTauri() ? (
              <button
                className="rounded-xl border border-[var(--warning)]/50 bg-[var(--warning)]/10 px-5 py-2.5 text-sm font-medium text-[var(--warning)] transition-all duration-300 hover:bg-[var(--warning)]/20"
                onClick={stopDiscovery}
                type="button"
              >
                {t("discovery.stop")}
              </button>
            ) : null}
          </div>

          {showProgressPanel ? (
            <div className="mt-5 space-y-3 rounded-[12px] border border-[var(--glass-border)] bg-[var(--glass-bg)]/60 p-4">
              {progress ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-medium text-[var(--text-primary)]">
                      {t(phaseLabelKey(progress.phase), progress.phase)}
                    </p>
                    <span className="text-[10px] tabular-nums text-[var(--text-secondary)]">
                      {t("discovery.foundMoonraker", { count: progress.foundMoonraker })}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
                    {indeterminate ? (
                      <div className="h-full w-full animate-pulse rounded-full bg-[var(--accent)]/70" />
                    ) : (
                      <motion.div
                        animate={{ width: `${barPercent}%` }}
                        className="h-full rounded-full bg-[var(--accent)]"
                        initial={{ width: 0 }}
                        transition={{ duration: 0.2 }}
                      />
                    )}
                  </div>
                  {progress.total > 0 ? (
                    <p className="text-[11px] tabular-nums text-[var(--text-secondary)]">
                      {t("discovery.addressesProgress", {
                        scanned: progress.scanned,
                        total: progress.total,
                      })}
                    </p>
                  ) : null}
                  {progress.current ? (
                    <p className="truncate font-mono text-[11px] text-[var(--text-secondary)]">
                      {t("discovery.currentHost", { host: progress.current })}
                    </p>
                  ) : null}
                </div>
              ) : null}

              {probe ? (
                <div className="border-t border-[var(--glass-border)] pt-3">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--text-secondary)]">
                    {t("discovery.probeTitle")}
                  </p>
                  <p className="mt-1 truncate font-mono text-xs text-[var(--text-primary)]">
                    {t("discovery.probeLine", {
                      host: probe.host,
                      index: probe.index,
                      total: probe.total,
                    })}
                  </p>
                </div>
              ) : null}

              {logs.length > 0 ? (
                <div className="border-t border-[var(--glass-border)] pt-3">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--text-secondary)]">
                    {t("discovery.logsTitle")}
                  </p>
                  <ul className="mt-2 max-h-28 space-y-1 overflow-y-auto text-xs">
                    {logs.map((log, i) => (
                      <li
                        className={
                          log.level === "error"
                            ? "text-[var(--warning)]"
                            : log.level === "warn"
                              ? "text-[var(--printing)]"
                              : "text-[var(--text-secondary)]"
                        }
                        key={`${i}-${log.message.slice(0, 24)}`}
                      >
                        {log.message}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}

          {error ? (
            <p className="mt-4 rounded-[12px] border border-[var(--warning)]/40 bg-[var(--warning)]/10 px-3 py-2 text-sm text-[var(--warning)]">
              {error}
            </p>
          ) : null}

          {!searching && !error ? (
            <p className="mt-6 text-sm text-[var(--text-secondary)]">{t("discovery.emptyHint")}</p>
          ) : null}
        </div>
      </motion.div>
    </div>
  );
}
