import * as Dialog from "@radix-ui/react-dialog";
import { AlertTriangle, ChevronDown } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { extractHostOsFromSystemInfo } from "../lib/machineSystemInfoDisplay";
import {
  getMoonrakerSystemPackageCount,
  listSoftwareUpdaters,
} from "../lib/moonrakerSoftwareUpdaters";
import { parseHostSoftwareSnapshot } from "../lib/parseHostSoftwareSnapshot";
import { invokeSshExecPreset, type SshEndpointPayload } from "../lib/sshInvoke";
import { isTauri } from "../lib/isTauri";
import {
  fetchMachineUpdateStatus,
  postMachineUpdateRefresh,
  postMachineUpdateUpgrade,
} from "../moonraker/client";
import type { MoonrakerMachineUpdateStatus } from "../moonraker/types";

const CAN_TOOLHEAD =
  "https://canbus.esoterical.online/toolhead_klipper_updating.html";
const CAN_MAINBOARD =
  "https://canbus.esoterical.online/mainboard_klipper_updating.html";
const KIAUH = "https://github.com/dw-0/kiauh";

function formatOpError(e: unknown, developerMode: boolean, t: (k: string) => string): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (developerMode) {
    return msg;
  }
  return t("hub.operationFailedShort");
}

export function HubUpdatesPanel({
  baseUrl,
  apiKey,
  developerMode,
  systemInfo,
  updateStatus,
  onUpdateStatus,
  sshOk,
  sshEndpoint,
}: {
  baseUrl: string;
  apiKey?: string;
  developerMode: boolean;
  systemInfo: unknown;
  updateStatus: MoonrakerMachineUpdateStatus | null;
  onUpdateStatus: (u: MoonrakerMachineUpdateStatus | null) => void;
  sshOk: boolean;
  sshEndpoint: SshEndpointPayload | null;
}) {
  const { t } = useTranslation();
  const [hostSnapLoading, setHostSnapLoading] = useState(false);
  const [hostSnapError, setHostSnapError] = useState<string | null>(null);
  const [hostSnap, setHostSnap] = useState<ReturnType<typeof parseHostSoftwareSnapshot> | null>(
    null,
  );
  const [refreshBusy, setRefreshBusy] = useState(false);
  const [upgradeBusy, setUpgradeBusy] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [expertOpen, setExpertOpen] = useState(false);

  const versionInfo = updateStatus?.version_info;
  const busy = updateStatus?.busy === true;

  const { distributionLine, cpuArchLine } = useMemo(
    () => extractHostOsFromSystemInfo(systemInfo),
    [systemInfo],
  );

  const moonPkg = useMemo(() => getMoonrakerSystemPackageCount(versionInfo), [versionInfo]);

  const softwareRows = useMemo(() => listSoftwareUpdaters(versionInfo), [versionInfo]);

  const loadHostSnapshot = useCallback(async () => {
    if (!isTauri() || !sshOk || !sshEndpoint) {
      setHostSnap(null);
      setHostSnapError(null);
      return;
    }
    setHostSnapLoading(true);
    setHostSnapError(null);
    try {
      const ex = await invokeSshExecPreset(sshEndpoint, "host_software_snapshot");
      const text = `${ex.stdout}\n${ex.stderr ?? ""}`;
      setHostSnap(parseHostSoftwareSnapshot(text));
    } catch (e) {
      setHostSnap(null);
      setHostSnapError(e instanceof Error ? e.message : String(e));
    } finally {
      setHostSnapLoading(false);
    }
  }, [sshEndpoint, sshOk]);

  useEffect(() => {
    void loadHostSnapshot();
  }, [loadHostSnapshot]);

  const reloadStatusGet = useCallback(async () => {
    try {
      const us = await fetchMachineUpdateStatus(baseUrl, apiKey);
      onUpdateStatus(us);
    } catch {
      /* keep previous */
    }
  }, [apiKey, baseUrl, onUpdateStatus]);

  const onRefreshMoonraker = async () => {
    setRefreshBusy(true);
    setFeedback(null);
    try {
      const us = await postMachineUpdateRefresh(baseUrl, apiKey, null);
      onUpdateStatus(us);
      await loadHostSnapshot();
      setFeedback(t("hub.updatesRefreshed"));
    } catch (e) {
      setFeedback(formatOpError(e, developerMode, t));
    } finally {
      setRefreshBusy(false);
    }
  };

  const onUpgradeOne = async (name: string) => {
    if (busy || upgradeBusy) {
      return;
    }
    setUpgradeBusy(name);
    setFeedback(null);
    try {
      await postMachineUpdateUpgrade(baseUrl, apiKey, name);
      await reloadStatusGet();
      await loadHostSnapshot();
      setFeedback(t("hub.upgradeOk", { name }));
    } catch (e) {
      setFeedback(formatOpError(e, developerMode, t));
    } finally {
      setUpgradeBusy(null);
    }
  };

  const onUpgradeAllSoftware = async () => {
    const targets = softwareRows.filter((r) => r.needsUpdate);
    if (targets.length === 0 || busy) {
      return;
    }
    setUpgradeBusy("__all__");
    setFeedback(null);
    try {
      for (const row of targets) {
        await postMachineUpdateUpgrade(baseUrl, apiKey, row.key);
        await reloadStatusGet();
      }
      await loadHostSnapshot();
      setFeedback(t("hub.upgradeAllOk"));
    } catch (e) {
      setFeedback(formatOpError(e, developerMode, t));
    } finally {
      setUpgradeBusy(null);
    }
  };

  const pkgCount =
    moonPkg !== null ? moonPkg : hostSnap !== null ? hostSnap.aptUpgradeCount : null;
  const pkgSourceKey =
    moonPkg !== null ? "moonraker" : hostSnap !== null ? "ssh" : hostSnapLoading ? "loading" : "none";

  const kernelLine =
    !isTauri() || !sshOk
      ? "—"
      : hostSnapLoading
        ? t("common.loading")
        : hostSnap?.kernel ?? "—";
  const archLine =
    !isTauri() || !sshOk
      ? cpuArchLine ?? "—"
      : hostSnapLoading
        ? t("common.loading")
        : hostSnap?.machineArch ?? cpuArchLine ?? "—";

  return (
    <div className="space-y-3 text-sm text-[var(--text-primary)]">
      <div className="flex flex-wrap items-center gap-2">
        <p className="flex-1 text-[var(--text-secondary)]">{t("hub.updatesIntroShort")}</p>
        <button
          className="rounded-xl border border-[var(--glass-border)] px-3 py-1.5 text-xs font-medium transition-all hover:brightness-105 disabled:opacity-50"
          disabled={refreshBusy || busy}
          onClick={() => void onRefreshMoonraker()}
          type="button"
        >
          {refreshBusy ? t("common.loading") : t("hub.refreshUpdateStatus")}
        </button>
      </div>
      {busy ? (
        <p className="text-xs text-amber-600 dark:text-amber-400">{t("hub.updateManagerBusy")}</p>
      ) : null}
      {feedback ? (
        <p className="rounded-lg border border-[var(--glass-border)] bg-[var(--glass-bg)]/40 px-2 py-1.5 text-xs whitespace-pre-wrap">
          {feedback}
        </p>
      ) : null}

      <details className="group rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)]/30 open:pb-2" open>
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-xl px-3 py-2 font-medium [&::-webkit-details-marker]:hidden">
          <span>{t("hub.sectionHostUpdates")}</span>
          <ChevronDown className="size-4 shrink-0 transition-transform group-open:rotate-180" />
        </summary>
        <div className="space-y-1.5 border-t border-[var(--glass-border)]/50 px-3 pt-2 text-xs">
          <div className="flex justify-between gap-2">
            <span className="text-[var(--text-secondary)]">{t("hub.hostOs")}</span>
            <span className="text-right font-mono text-[11px]">{distributionLine ?? "—"}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-[var(--text-secondary)]">{t("hub.hostKernel")}</span>
            <span className="text-right font-mono text-[11px]">{kernelLine}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-[var(--text-secondary)]">{t("hub.hostArch")}</span>
            <span className="text-right font-mono text-[11px]">{archLine}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-[var(--text-secondary)]">{t("hub.hostPackagesPending")}</span>
            <span className="text-right font-mono text-[11px]">
              {pkgCount !== null ? pkgCount : "—"}
            </span>
          </div>
          <p className="text-[10px] leading-snug text-[var(--text-secondary)]">
            {pkgSourceKey === "moonraker"
              ? t("hub.hostPackagesHintMoonraker")
              : pkgSourceKey === "ssh"
                ? t("hub.hostPackagesHintSsh")
                : !isTauri()
                  ? t("hub.hostSnapshotWeb")
                  : !sshOk
                    ? t("hub.hostSnapshotSshOnly")
                    : hostSnapLoading
                      ? t("hub.hostPackagesLoading")
                      : hostSnapError
                        ? developerMode
                          ? hostSnapError
                          : t("hub.hostSnapshotFailed")
                        : t("hub.hostPackagesUnavailable")}
          </p>
        </div>
      </details>

      <details className="group rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)]/30 open:pb-2" open>
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-xl px-3 py-2 font-medium [&::-webkit-details-marker]:hidden">
          <span>{t("hub.sectionPrinterSoftware")}</span>
          <ChevronDown className="size-4 shrink-0 transition-transform group-open:rotate-180" />
        </summary>
        <div className="border-t border-[var(--glass-border)]/50 px-3 pt-2">
          <div className="mb-2 flex flex-wrap items-center justify-end gap-2">
            <button
              className="rounded-lg bg-[var(--accent)] px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              disabled={
                busy ||
                upgradeBusy !== null ||
                softwareRows.every((r) => !r.needsUpdate)
              }
              onClick={() => void onUpgradeAllSoftware()}
              type="button"
            >
              {t("hub.updateAllModules")}
            </button>
          </div>
          {softwareRows.length === 0 ? (
            <p className="text-xs text-[var(--text-secondary)]">{t("hub.noSoftwareUpdaters")}</p>
          ) : (
            <ul className="space-y-2">
              {softwareRows.map((row) => (
                <li
                  className="flex flex-col gap-1 rounded-lg border border-[var(--glass-border)]/60 bg-white/30 p-2 dark:bg-black/20 sm:flex-row sm:items-center sm:justify-between"
                  key={row.key}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium">{row.name}</p>
                    <p className="font-mono text-[10px] text-[var(--text-secondary)]">
                      {row.needsUpdate ? (
                        <>
                          <span className="text-[var(--text-primary)]">{row.versionDisplay}</span>
                          {" → "}
                          <span className="text-[var(--text-primary)]">{row.remoteDisplay}</span>
                        </>
                      ) : (
                        <span className="text-[var(--text-primary)]">{row.versionDisplay}</span>
                      )}
                    </p>
                    {row.corrupt || !row.isValid ? (
                      <p className="text-[10px] text-[var(--warning)]">{t("hub.updaterInvalid")}</p>
                    ) : null}
                  </div>
                  <button
                    className="shrink-0 rounded-lg border border-[var(--glass-border)] px-2 py-1 text-[11px] font-medium transition-all hover:brightness-105 disabled:opacity-50"
                    disabled={
                      busy ||
                      upgradeBusy !== null ||
                      !row.isValid ||
                      row.corrupt ||
                      !row.needsUpdate
                    }
                    onClick={() => void onUpgradeOne(row.key)}
                    type="button"
                  >
                    {row.needsUpdate ? t("hub.updateModule") : t("hub.upToDate")}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </details>

      <details className="group rounded-xl border border-[var(--warning)]/45 bg-[var(--warning)]/8 open:pb-2">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-xl px-3 py-2 font-medium text-[var(--warning)] [&::-webkit-details-marker]:hidden">
          <span className="flex items-center gap-2">
            <AlertTriangle className="size-4 shrink-0" strokeWidth={2.25} />
            {t("hub.sectionMcuFirmware")}
          </span>
          <ChevronDown className="size-4 shrink-0 transition-transform group-open:rotate-180" />
        </summary>
        <div className="space-y-2 border-t border-[var(--warning)]/25 px-3 pt-2 text-xs">
          <p className="text-[var(--text-secondary)]">{t("hub.mcuFirmwareWarningShort")}</p>
          <Dialog.Root open={expertOpen} onOpenChange={setExpertOpen}>
            <Dialog.Trigger asChild>
              <button
                className="rounded-lg border border-[var(--warning)]/50 bg-[var(--warning)]/15 px-3 py-1.5 text-xs font-medium text-[var(--text-primary)] transition-all hover:brightness-105"
                type="button"
              >
                {t("hub.mcuFirmwareExpertButton")}
              </button>
            </Dialog.Trigger>
            <Dialog.Portal>
              <Dialog.Overlay className="fixed inset-0 z-[300] bg-black/50 backdrop-blur-sm" />
              <Dialog.Content className="fixed left-1/2 top-1/2 z-[301] w-[min(100vw-2rem,22rem)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-bg)] p-4 shadow-[var(--card-shadow)] backdrop-blur-xl">
                <Dialog.Title className="flex items-center gap-2 text-sm font-semibold text-[var(--warning)]">
                  <AlertTriangle className="size-5" />
                  {t("hub.mcuFirmwareExpertTitle")}
                </Dialog.Title>
                <Dialog.Description className="mt-2 space-y-2 text-xs leading-relaxed text-[var(--text-secondary)]">
                  {t("hub.mcuFirmwareExpertBody")}
                </Dialog.Description>
                <ul className="mt-3 list-inside list-disc space-y-1.5 text-xs text-[var(--accent)]">
                  <li>
                    <a className="underline hover:opacity-90" href={KIAUH} rel="noreferrer" target="_blank">
                      {t("hub.linkKiauh")}
                    </a>
                  </li>
                  <li>
                    <a
                      className="underline hover:opacity-90"
                      href={CAN_TOOLHEAD}
                      rel="noreferrer"
                      target="_blank"
                    >
                      {t("hub.linkCanToolhead")}
                    </a>
                  </li>
                  <li>
                    <a
                      className="underline hover:opacity-90"
                      href={CAN_MAINBOARD}
                      rel="noreferrer"
                      target="_blank"
                    >
                      {t("hub.linkCanMainboard")}
                    </a>
                  </li>
                </ul>
                <Dialog.Close className="mt-4 w-full rounded-xl bg-[var(--accent)] py-2 text-xs font-medium text-white">
                  {t("settings.close")}
                </Dialog.Close>
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>
        </div>
      </details>
    </div>
  );
}
