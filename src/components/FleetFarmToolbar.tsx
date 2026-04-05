import clsx from "clsx";
import { CheckSquare, Loader2, Package, RefreshCw, Rocket } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  bulkFullMoonrakerUpgradeIdleOnly,
  bulkSystemPackagesUpgradeIdleOnly,
} from "../lib/fleetBulkMoonraker";
import { useFleetDeferredUpdateStore } from "../store/fleetDeferredUpdateStore";
import { useFleetInventoryStore } from "../store/fleetInventoryStore";
import { useFleetSelectionStore } from "../store/fleetSelectionStore";
import { usePrinterStore } from "../store/printerStore";

function toolbarButtonClass(active?: boolean) {
  return clsx(
    "inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-medium transition-all duration-300",
    active
      ? "border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--accent)] shadow-[0_0_0_1px_var(--accent_glow)]"
      : "border-[var(--glass-border)] bg-[var(--glass-bg)] text-[var(--text-primary)] hover:brightness-105",
  );
}

export function FleetFarmToolbar() {
  const { t } = useTranslation();
  const printers = usePrinterStore((s) => s.printers);
  const gridEditMode = usePrinterStore((s) => s.gridEditMode);
  const refreshPrinters = useFleetInventoryStore((s) => s.refreshPrinters);
  const refreshRunning = useFleetInventoryStore((s) => s.refreshRunning);
  const selectMode = useFleetSelectionStore((s) => s.selectMode);
  const setSelectMode = useFleetSelectionStore((s) => s.setSelectMode);
  const selectedIds = useFleetSelectionStore((s) => s.selectedIds);
  const clearSelection = useFleetSelectionStore((s) => s.clearSelection);
  const selectAllPrinterIds = useFleetSelectionStore((s) => s.selectAllPrinterIds);
  const queuedIds = useFleetDeferredUpdateStore((s) => s.queuedIds);
  const enqueue = useFleetDeferredUpdateStore((s) => s.enqueue);
  const clearQueue = useFleetDeferredUpdateStore((s) => s.clear);

  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkMessage, setBulkMessage] = useState<string | null>(null);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  useEffect(() => {
    if (bulkMessage === null) {
      return;
    }
    const id = window.setTimeout(() => setBulkMessage(null), 9000);
    return () => clearTimeout(id);
  }, [bulkMessage]);

  const onSync = useCallback(() => {
    void refreshPrinters(printers);
  }, [printers, refreshPrinters]);

  const onBulkFull = useCallback(async () => {
    if (selectedIds.length === 0) {
      return;
    }
    setBulkBusy(true);
    try {
      const r = await bulkFullMoonrakerUpgradeIdleOnly(printers, selectedSet);
      setBulkMessage(t("fleet.bulkResult", r));
      void refreshPrinters(printers);
    } finally {
      setBulkBusy(false);
    }
  }, [printers, refreshPrinters, selectedIds.length, selectedSet, t]);

  const onBulkSystem = useCallback(async () => {
    if (selectedIds.length === 0) {
      return;
    }
    setBulkBusy(true);
    try {
      const r = await bulkSystemPackagesUpgradeIdleOnly(printers, selectedSet);
      setBulkMessage(t("fleet.bulkResult", r));
      void refreshPrinters(printers);
    } finally {
      setBulkBusy(false);
    }
  }, [printers, refreshPrinters, selectedIds.length, selectedSet, t]);

  const onQueueIdle = useCallback(() => {
    for (const id of selectedIds) {
      enqueue(id);
    }
    setBulkMessage(t("fleet.queuedSelected", { count: selectedIds.length }));
  }, [enqueue, selectedIds, t]);

  if (printers.length === 0) {
    return null;
  }

  const disabledChrome = gridEditMode || refreshRunning;
  const canBulk = selectMode && selectedIds.length > 0 && !bulkBusy && !gridEditMode;

  return (
    <div className="mb-3 shrink-0 space-y-2 border-b border-[var(--glass-border)]/35 pb-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          className={toolbarButtonClass(false)}
          disabled={disabledChrome}
          onClick={onSync}
          title={t("fleet.syncInventoryHint")}
          type="button"
        >
          {refreshRunning ? (
            <Loader2 aria-hidden className="size-3.5 animate-spin" strokeWidth={2.25} />
          ) : (
            <RefreshCw aria-hidden className="size-3.5" strokeWidth={2.25} />
          )}
          {refreshRunning ? t("fleet.syncing") : t("fleet.syncInventory")}
        </button>
        <button
          className={toolbarButtonClass(selectMode)}
          disabled={gridEditMode}
          onClick={() => setSelectMode(!selectMode)}
          type="button"
        >
          <CheckSquare aria-hidden className="size-3.5" strokeWidth={2.25} />
          {t("fleet.selectMode")}
        </button>
        {selectMode ? (
          <>
            <button
              className={toolbarButtonClass(false)}
              disabled={gridEditMode}
              onClick={() => selectAllPrinterIds(printers.map((p) => p.id))}
              type="button"
            >
              {t("fleet.selectAll")}
            </button>
            <button
              className={toolbarButtonClass(false)}
              disabled={gridEditMode || selectedIds.length === 0}
              onClick={() => clearSelection()}
              type="button"
            >
              {t("fleet.selectNone")}
            </button>
          </>
        ) : null}
      </div>

      {selectMode ? (
        <p className="text-[11px] leading-snug text-[var(--text-secondary)]">{t("fleet.selectModeHint")}</p>
      ) : null}

      {selectMode && selectedIds.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          <button
            className={toolbarButtonClass(false)}
            disabled={!canBulk}
            onClick={() => void onBulkFull()}
            type="button"
          >
            <Rocket aria-hidden className="size-3.5" strokeWidth={2.25} />
            {t("fleet.upgradeIdleFull")}
          </button>
          <button
            className={toolbarButtonClass(false)}
            disabled={!canBulk}
            onClick={() => void onBulkSystem()}
            type="button"
          >
            <Package aria-hidden className="size-3.5" strokeWidth={2.25} />
            {t("fleet.upgradeIdleSystem")}
          </button>
          <button
            className={toolbarButtonClass(false)}
            disabled={gridEditMode || selectedIds.length === 0}
            onClick={onQueueIdle}
            type="button"
          >
            {t("fleet.queueWhenIdle")}
          </button>
        </div>
      ) : null}

      {queuedIds.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--glass-border)]/60 bg-[var(--glass-bg)]/40 px-3 py-2 text-[11px] text-[var(--text-secondary)]">
          <span className="text-[var(--text-primary)]">
            {t("fleet.queuedCount", { count: queuedIds.length })}
          </span>
          <button
            className="rounded-lg border border-[var(--glass-border)] px-2 py-0.5 text-[11px] font-medium text-[var(--accent)] transition-opacity hover:opacity-80"
            onClick={() => clearQueue()}
            type="button"
          >
            {t("fleet.clearQueue")}
          </button>
        </div>
      ) : null}

      {bulkMessage ? (
        <p className="text-[11px] leading-snug text-[var(--text-secondary)]">{bulkMessage}</p>
      ) : null}
    </div>
  );
}
