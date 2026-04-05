import clsx from "clsx";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowUp, Check, Minus, Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { isDeviceVersionBehindTag } from "../lib/semverFirmware";
import { isDirtyVersion, stripVersionForDisplay } from "../lib/versionLabel";
import { enqueueFleetSnapshot } from "../moonraker/fleetSnapshotQueue";
import {
  buildPrinterSnapshot,
  formatSystemUptime,
  formatWaitDuration,
  type PrinterSnapshot,
} from "../moonraker/snapshot";
import {
  formatStatusTooltipTitle,
  resolvePrinterStatusTooltip,
} from "../moonraker/statusTooltip";
import { useFleetInventoryStore } from "../store/fleetInventoryStore";
import { useFleetSelectionStore } from "../store/fleetSelectionStore";
import { usePrinterStore, type SavedPrinter } from "../store/printerStore";
import { useUpstreamVersionsStore } from "../store/upstreamVersionsStore";
import { StatusDot, type StatusDotKind } from "./StatusDot";

function hostFromBaseUrl(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

/** Spread first poll across cards so a large grid does not hit Moonraker all at once. */
function pollStaggerMs(printerId: string): number {
  let h = 0;
  for (let i = 0; i < printerId.length; i++) {
    h = (h * 31 + printerId.charCodeAt(i)) | 0;
  }
  return Math.abs(h % 3500);
}

/** Short label for dense cards; full string stays in title=. */
function compactVersion(s: string, maxChars = 16): string {
  const t = s.trim();
  if (t.length <= maxChars) {
    return t;
  }
  return `${t.slice(0, Math.max(0, maxChars - 1))}…`;
}

/** iOS-style gentle wobble in edit mode: two endpoints + mirror repeat → no seam at loop. */
const EDIT_FARM_WOBBLE_DEG = 0.55;
const editFarmWobbleTransition = {
  rotate: {
    duration: 2.65,
    repeat: Infinity,
    repeatType: "mirror" as const,
    ease: "easeInOut" as const,
  },
};
const editFarmWobbleStopTransition = { rotate: { duration: 0.28, ease: "easeOut" as const } };

function EditFarmCornerBadge({
  confirmDiscoveryPrinter,
  editMode,
  isNewFromDiscovery,
  isPendingRemoval,
  onTogglePendingRemoval,
  printerId,
  t,
}: {
  confirmDiscoveryPrinter: (id: string) => void;
  editMode: boolean;
  isNewFromDiscovery: boolean;
  isPendingRemoval: boolean;
  onTogglePendingRemoval: (id: string) => void;
  printerId: string;
  t: (key: string) => string;
}) {
  if (!editMode) {
    return null;
  }
  if (isNewFromDiscovery) {
    return (
      <button
        aria-label={t("discovery.a11yConfirmAdd")}
        className="absolute -left-1 -top-1 z-20 flex size-6 items-center justify-center rounded-full bg-[var(--success)] text-white shadow-md transition-opacity hover:opacity-90"
        onClick={(e) => {
          e.stopPropagation();
          confirmDiscoveryPrinter(printerId);
        }}
        title={t("printer.justAddedBadge")}
        type="button"
      >
        <Plus aria-hidden className="size-3.5" strokeWidth={2.75} />
      </button>
    );
  }
  if (isPendingRemoval) {
    return (
      <button
        aria-label={t("printer.a11yKeepInFarm")}
        className="absolute -left-1 -top-1 z-20 flex size-6 items-center justify-center rounded-full bg-[var(--success)] text-white shadow-md transition-opacity hover:opacity-90"
        onClick={(e) => {
          e.stopPropagation();
          onTogglePendingRemoval(printerId);
        }}
        title={t("printer.keepPrinterHint")}
        type="button"
      >
        <Plus aria-hidden className="size-3.5" strokeWidth={2.75} />
      </button>
    );
  }
  return (
    <button
      aria-label={t("printer.a11yMarkForRemoval")}
      className="absolute -left-1 -top-1 z-20 flex size-6 items-center justify-center rounded-full bg-[var(--warning)] text-white shadow-md transition-opacity hover:opacity-90"
      onClick={(e) => {
        e.stopPropagation();
        onTogglePendingRemoval(printerId);
      }}
      title={t("printer.removeOnDoneHint")}
      type="button"
    >
      <Minus aria-hidden className="size-3.5" strokeWidth={2.5} />
    </button>
  );
}

export function PrinterCard({
  printer,
  editMode = false,
  className,
}: {
  printer: SavedPrinter;
  editMode?: boolean;
  className?: string;
}) {
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const { t, i18n } = useTranslation();
  const lang = i18n.resolvedLanguage ?? i18n.language;
  const updatePrinter = usePrinterStore((s) => s.updatePrinter);
  const confirmDiscoveryPrinter = usePrinterStore((s) => s.confirmDiscoveryPrinter);
  const togglePendingRemoval = usePrinterStore((s) => s.togglePendingRemoval);
  const isNewFromDiscovery = usePrinterStore((s) =>
    s.newFromDiscoveryIds.includes(printer.id),
  );
  const isPendingRemoval = usePrinterStore((s) => s.pendingRemovalIds.includes(printer.id));
  const fleetSelectMode = useFleetSelectionStore((s) => s.selectMode && !editMode);
  const fleetSelected = useFleetSelectionStore((s) => s.selectedIds.includes(printer.id));
  const toggleFleetSelect = useFleetSelectionStore((s) => s.toggle);
  const fleetInv = useFleetInventoryStore((s) => s.byId[printer.id]);

  const fleetPendingTotal =
    fleetInv?.reachable === true
      ? (fleetInv.hostPackagesPending ?? 0) + fleetInv.managedSoftwareUpdates
      : 0;
  const showFleetPendingBadge = fleetInv?.reachable === true && fleetPendingTotal > 0;
  const fleetPendingTitle = useMemo(() => {
    if (!fleetInv?.reachable) {
      return undefined;
    }
    return t("fleet.pendingTooltip", {
      software: fleetInv.managedSoftwareUpdates,
      host: fleetInv.hostPackagesPending ?? 0,
    });
  }, [fleetInv, t]);

  const onCardContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      togglePendingRemoval(printer.id);
    },
    [printer.id, togglePendingRemoval],
  );
  const klipperUpstreamTag = useUpstreamVersionsStore((s) => s.klipperTag);
  const moonrakerUpstreamTag = useUpstreamVersionsStore((s) => s.moonrakerTag);
  const [snap, setSnap] = useState<PrinterSnapshot | null>(null);
  const [apiKeyDraft, setApiKeyDraft] = useState(printer.apiKey ?? "");
  const fallback = printer.displayName ?? hostFromBaseUrl(printer.baseUrl);

  useEffect(() => {
    setApiKeyDraft(printer.apiKey ?? "");
  }, [printer.apiKey]);

  useEffect(() => {
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const pollIntervalMs = 5000;

    const runTick = async () => {
      if (cancelled) {
        return;
      }
      const s = await enqueueFleetSnapshot(() =>
        buildPrinterSnapshot(printer.baseUrl, fallback, printer.apiKey),
      );
      if (cancelled) {
        return;
      }
      setSnap(s);
      timeoutId = setTimeout(() => void runTick(), pollIntervalMs);
    };

    const stagger = pollStaggerMs(printer.id);
    timeoutId = setTimeout(() => void runTick(), stagger);

    return () => {
      cancelled = true;
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }
    };
  }, [printer.id, printer.baseUrl, printer.apiKey, fallback]);

  const handlePrimaryActivate = useCallback(() => {
    if (fleetSelectMode) {
      toggleFleetSelect(printer.id);
      return;
    }
    if (!editMode) {
      navigate(`/printer/${printer.id}`);
    }
  }, [editMode, fleetSelectMode, navigate, printer.id, toggleFleetSelect]);

  const idleAnchorUnixSec =
    snap && snap.isIdleReady && snap.lastPrintEndUnixSec != null ? snap.lastPrintEndUnixSec : null;

  const [idleSec, setIdleSec] = useState(0);
  useEffect(() => {
    if (idleAnchorUnixSec === null) {
      setIdleSec(0);
      return;
    }
    const fn = () =>
      setIdleSec(Math.max(0, Math.floor(Date.now() / 1000 - idleAnchorUnixSec)));
    fn();
    const id = setInterval(fn, 1000);
    return () => clearInterval(id);
  }, [idleAnchorUnixSec]);

  if (!snap) {
    return (
      <>
        <motion.div
          className={clsx(
            "glass glass-interactive relative flex h-full min-h-[115px] flex-col rounded-xl p-[11px]",
            !editMode && "cursor-pointer",
            fleetSelected && fleetSelectMode && "ring-2 ring-[var(--accent)]/70",
            className,
          )}
          layout={false}
          onClick={editMode ? undefined : handlePrimaryActivate}
          onContextMenu={onCardContextMenu}
          onKeyDown={
            editMode
              ? undefined
              : (e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handlePrimaryActivate();
                  }
                }
          }
          role={editMode ? undefined : "button"}
          tabIndex={editMode ? undefined : 0}
          title={
            editMode ? undefined : fleetSelectMode ? t("fleet.selectToToggle") : t("printer.openHub")
          }
        >
          <EditFarmCornerBadge
            confirmDiscoveryPrinter={confirmDiscoveryPrinter}
            editMode={editMode}
            isNewFromDiscovery={isNewFromDiscovery}
            isPendingRemoval={isPendingRemoval}
            onTogglePendingRemoval={togglePendingRemoval}
            printerId={printer.id}
            t={t}
          />
          {fleetSelectMode ? (
            <span
              aria-hidden
              className={clsx(
                "pointer-events-none absolute right-2 top-2 z-10 flex size-5 items-center justify-center rounded-md border-2",
                fleetSelected
                  ? "border-[var(--accent)] bg-[var(--accent)]/25"
                  : "border-[var(--glass-border)] bg-[var(--glass-bg)]/85",
              )}
            >
              {fleetSelected ? (
                <Check aria-hidden className="size-3.5 text-[var(--accent)]" strokeWidth={2.75} />
              ) : null}
            </span>
          ) : null}
          {showFleetPendingBadge ? (
            <span
              className={clsx(
                "pointer-events-none absolute z-10 flex min-h-[18px] min-w-[18px] items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-white shadow-sm",
                fleetSelectMode ? "bottom-2 left-2" : "bottom-2 right-2",
              )}
              title={fleetPendingTitle}
            >
              {fleetPendingTotal > 99 ? "99+" : fleetPendingTotal}
            </span>
          ) : null}
          <motion.div
            animate={
              editMode
                ? { rotate: [-EDIT_FARM_WOBBLE_DEG, EDIT_FARM_WOBBLE_DEG] }
                : { rotate: 0 }
            }
            className="flex min-h-0 flex-1 flex-col"
            initial={false}
            style={{ transformOrigin: "50% 55%" }}
            transition={editMode ? editFarmWobbleTransition : editFarmWobbleStopTransition}
          >
            <p className="truncate text-[12px] text-[var(--text-secondary)]">{fallback}</p>
          </motion.div>
        </motion.div>
      </>
    );
  }

  const mcuMain = snap.mcuVersions[0];
  const mcuRest = snap.mcuVersions.slice(1);

  const dirtyMoonraker = isDirtyVersion(snap.moonrakerVersion);
  const dirtyKlipperHost = isDirtyVersion(snap.klipperHostVersion);
  const dirtyMcuRow = snap.mcuVersions.some((m) => isDirtyVersion(m.version));
  const hasDirtyBuild = dirtyMoonraker || dirtyKlipperHost || dirtyMcuRow;

  const headerStatus: StatusDotKind =
    snap.status === "ready" && hasDirtyBuild ? "dirtyBuild" : snap.status;

  const statusTipResolved = resolvePrinterStatusTooltip(snap, headerStatus);
  const statusTooltip =
    statusTipResolved !== null
      ? formatStatusTooltipTitle(statusTipResolved, (key, opts) => t(key, opts))
      : undefined;

  const secondaryLine = snap.printFilename
    ? t("printer.printing", { file: snap.printFilename })
    : snap.isIdleReady && snap.lastPrintEndUnixSec != null
      ? t("printer.idleWaiting", { duration: formatWaitDuration(idleSec, lang) })
      : snap.isIdleReady
        ? t("printer.idleJustNow")
        : "—";

  const mrV = stripVersionForDisplay(snap.moonrakerVersion);
  const khV = stripVersionForDisplay(snap.klipperHostVersion);

  const mrBehind = isDeviceVersionBehindTag(snap.moonrakerVersion, moonrakerUpstreamTag);
  const khBehind = isDeviceVersionBehindTag(snap.klipperHostVersion, klipperUpstreamTag);
  const mrUpstreamHint =
    mrBehind && moonrakerUpstreamTag
      ? t("printer.upstreamNewerMoonraker", { tag: moonrakerUpstreamTag })
      : undefined;
  const khUpstreamHint =
    khBehind && klipperUpstreamTag
      ? t("printer.upstreamNewerKlipper", { tag: klipperUpstreamTag })
      : undefined;

  const mcuMainV = mcuMain ? stripVersionForDisplay(mcuMain.version) : "";
  const mcuLine = mcuMain
    ? mcuRest.length > 0
      ? `${mcuMain.name}: ${compactVersion(mcuMainV, 13)} +${mcuRest.length}`
      : `${mcuMain.name}: ${compactVersion(mcuMainV, 15)}`
    : "—";
  const mcuTitle = mcuMain
    ? mcuRest.length > 0
      ? [mcuMain, ...mcuRest]
          .map((m) => `${m.name}: ${stripVersionForDisplay(m.version)}`)
          .join("\n")
      : `${mcuMain.name}: ${mcuMainV}`
    : undefined;

  return (
    <>
      <motion.article
        animate={{ opacity: 1, y: 0 }}
        className={clsx(
          "glass glass-interactive relative flex h-full min-h-[115px] flex-col rounded-xl p-[11px]",
          !editMode && "cursor-pointer",
          fleetSelected && fleetSelectMode && "ring-2 ring-[var(--accent)]/70",
          className,
        )}
        initial={{ opacity: 0, y: 6 }}
        layout={false}
        onClick={editMode ? undefined : handlePrimaryActivate}
        onContextMenu={onCardContextMenu}
        onKeyDown={
          editMode
            ? undefined
            : (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handlePrimaryActivate();
                }
              }
        }
        role={editMode ? undefined : "button"}
        tabIndex={editMode ? undefined : 0}
        title={
          editMode ? undefined : fleetSelectMode ? t("fleet.selectToToggle") : t("printer.openHub")
        }
        transition={{ duration: 0.22 }}
        whileTap={editMode || reduceMotion ? undefined : { scale: 0.98 }}
      >
        <EditFarmCornerBadge
          confirmDiscoveryPrinter={confirmDiscoveryPrinter}
          editMode={editMode}
          isNewFromDiscovery={isNewFromDiscovery}
          isPendingRemoval={isPendingRemoval}
          onTogglePendingRemoval={togglePendingRemoval}
          printerId={printer.id}
          t={t}
        />
        {fleetSelectMode ? (
          <span
            aria-hidden
            className={clsx(
              "pointer-events-none absolute right-2 top-2 z-10 flex size-5 items-center justify-center rounded-md border-2",
              fleetSelected
                ? "border-[var(--accent)] bg-[var(--accent)]/25"
                : "border-[var(--glass-border)] bg-[var(--glass-bg)]/85",
            )}
          >
            {fleetSelected ? (
              <Check aria-hidden className="size-3.5 text-[var(--accent)]" strokeWidth={2.75} />
            ) : null}
          </span>
        ) : null}
        {showFleetPendingBadge ? (
          <span
            className={clsx(
              "pointer-events-none absolute z-10 flex min-h-[18px] min-w-[18px] items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-white shadow-sm",
              fleetSelectMode ? "bottom-2 left-2" : "bottom-2 right-2",
            )}
            title={fleetPendingTitle}
          >
            {fleetPendingTotal > 99 ? "99+" : fleetPendingTotal}
          </span>
        ) : null}
        <motion.div
          animate={
            editMode
              ? { rotate: [-EDIT_FARM_WOBBLE_DEG, EDIT_FARM_WOBBLE_DEG] }
              : { rotate: 0 }
          }
          className="flex min-h-0 flex-1 flex-col"
          initial={false}
          style={{ transformOrigin: "50% 55%" }}
          transition={editMode ? editFarmWobbleTransition : editFarmWobbleStopTransition}
        >
      <div className="flex items-start gap-2">
        <span
          className={clsx(
            "inline-flex shrink-0 items-start gap-1.5",
            statusTooltip && "cursor-help",
          )}
          title={statusTooltip}
        >
          <StatusDot size="sm" status={headerStatus} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-1">
            <h2 className="truncate text-[13px] font-semibold leading-tight text-[var(--text-primary)]">
              {snap.hostname}
            </h2>
            <span
              className={clsx(
                "shrink-0 text-[9px] font-medium uppercase leading-none tracking-wide",
                headerStatus === "dirtyBuild"
                  ? "text-[var(--printing)]"
                  : "text-[var(--text-secondary)]",
                statusTooltip && "cursor-help",
              )}
              title={statusTooltip}
            >
              {t(`printer.status.${headerStatus}`)}
            </span>
          </div>
          <p className="mt-0.5 line-clamp-1 text-[11px] leading-tight text-[var(--text-secondary)]">
            {secondaryLine}
          </p>
        </div>
      </div>

      <dl className="mt-2 space-y-0.5 text-[11px] leading-tight">
        <div className="flex justify-between gap-1">
          <dt className="shrink-0 text-[var(--text-secondary)]">{t("printer.uptime")}</dt>
          <dd className="truncate text-right font-mono tabular-nums text-[var(--text-primary)]">
            {formatSystemUptime(snap.uptimeSec, lang)}
          </dd>
        </div>
        <div
          className={clsx(
            "flex justify-between gap-1 rounded px-0.5 py-px -mx-0.5",
            dirtyMoonraker && "bg-[var(--printing)]/15 ring-1 ring-[var(--printing)]/30",
          )}
        >
          <dt className="shrink-0 text-[var(--text-secondary)]">{t("printer.moonraker")}</dt>
          <dd
            className="flex min-w-0 items-center justify-end gap-1 text-right font-mono text-[var(--text-primary)]"
            title={mrUpstreamHint ? `${mrV} — ${mrUpstreamHint}` : mrV}
          >
            <span className="truncate">{compactVersion(mrV, 20)}</span>
            {mrBehind && mrUpstreamHint ? (
              <span
                aria-label={mrUpstreamHint}
                className="inline-flex shrink-0"
                role="img"
                title={mrUpstreamHint}
              >
                <ArrowUp
                  aria-hidden
                  className="size-3.5 text-[var(--success)]"
                  focusable="false"
                  strokeWidth={2.5}
                />
              </span>
            ) : null}
          </dd>
        </div>
        <div
          className={clsx(
            "flex justify-between gap-1 rounded px-0.5 py-px -mx-0.5",
            dirtyKlipperHost && "bg-[var(--printing)]/15 ring-1 ring-[var(--printing)]/30",
          )}
        >
          <dt className="shrink-0 text-[var(--text-secondary)]">{t("printer.klipperHost")}</dt>
          <dd
            className="flex min-w-0 items-center justify-end gap-1 text-right font-mono text-[var(--text-primary)]"
            title={khUpstreamHint ? `${khV} — ${khUpstreamHint}` : khV}
          >
            <span className="truncate">{compactVersion(khV, 20)}</span>
            {khBehind && khUpstreamHint ? (
              <span
                aria-label={khUpstreamHint}
                className="inline-flex shrink-0"
                role="img"
                title={khUpstreamHint}
              >
                <ArrowUp
                  aria-hidden
                  className="size-3.5 text-[var(--success)]"
                  focusable="false"
                  strokeWidth={2.5}
                />
              </span>
            ) : null}
          </dd>
        </div>
        <div
          className={clsx(
            "flex justify-between gap-1 rounded px-0.5 py-px -mx-0.5",
            dirtyMcuRow && "bg-[var(--printing)]/15 ring-1 ring-[var(--printing)]/30",
          )}
        >
          <dt className="shrink-0 text-[var(--text-secondary)]">{t("printer.klipperMcu")}</dt>
          <dd className="truncate text-right font-mono text-[var(--text-primary)]" title={mcuTitle}>
            {mcuLine}
          </dd>
        </div>
      </dl>

      {snap.status === "offline" && snap.offlineDetail === "auth" ? (
        <div
          className="mt-2 border-t border-[var(--glass-border)] pt-2"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          role="presentation"
        >
          <p className="text-[11px] leading-snug text-[var(--warning)]">{t("printer.offlineAuthHint")}</p>
          <div className="mt-1.5 flex flex-col gap-1.5">
            <input
              autoComplete="off"
              className="min-w-0 rounded-lg border border-[var(--glass-border)] bg-white/50 px-2 py-1 text-[12px] text-[var(--text-primary)] outline-none focus:ring-2 focus:ring-[var(--accent)] dark:bg-black/30"
              onChange={(e) => setApiKeyDraft(e.target.value)}
              placeholder={t("common.apiKey")}
              type="password"
              value={apiKeyDraft}
            />
            <button
              className="rounded-lg bg-[var(--accent)] px-2 py-1 text-[12px] font-medium text-white transition-opacity hover:opacity-90"
              onClick={() =>
                updatePrinter(printer.id, { apiKey: apiKeyDraft.trim() || undefined })
              }
              type="button"
            >
              {t("common.save")}
            </button>
          </div>
        </div>
      ) : null}

      {snap.status === "offline" && snap.offlineDetail === "unreachable" ? (
        <p className="mt-2 border-t border-[var(--glass-border)] pt-2 text-[11px] leading-snug text-[var(--text-secondary)]">
          {t("printer.offlineUnreachableHint")}
        </p>
      ) : null}

      {snap.status === "offline" && snap.offlineDetail === "http" ? (
        <p className="mt-2 border-t border-[var(--glass-border)] pt-2 text-[11px] leading-snug text-[var(--text-secondary)]">
          {t("printer.offlineHttpHint", { status: snap.httpStatus ?? 0 })}
        </p>
      ) : null}
        </motion.div>
      </motion.article>
    </>
  );
}
