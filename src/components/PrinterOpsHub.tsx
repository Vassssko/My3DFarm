import * as Popover from "@radix-ui/react-popover";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { AlertTriangle, Check, KeyRound, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { analyzeKlipperLogLines } from "../diagnostics/klipperLogHeuristics";
import { extractResolvedConfigFromKlipperLog } from "../diagnostics/extractKlipperConfigFromLog";
import {
  parseKlipperConfigSections,
  summarizeHardware,
} from "../diagnostics/parseKlipperConfigSections";
import { resolveEffectiveSsh, resolveEffectiveSshGlobalsOnly } from "../lib/effectiveSsh";
import { matchHostSshHint } from "../lib/matchHostSshHints";
import { compareNetworkSamples } from "../lib/healthNetworkHeuristic";
import { isTauri } from "../lib/isTauri";
import {
  fetchMachineSystemInfo,
  fetchMachineUpdateStatus,
  tryFetchKlippyLogTail,
} from "../moonraker/client";
import type { SshProbeKind } from "../lib/sshInvoke";
import {
  invokeSshDeployKey,
  invokeSshEnsureIdentity,
  invokeSshExecPreset,
  invokeSshProbe,
} from "../lib/sshInvoke";
import type { SavedPrinter } from "../store/printerStore";
import { useBaselineStore } from "../store/baselineStore";
import {
  EMPTY_NETWORK_SAMPLES,
  useHealthSamplesStore,
} from "../store/healthSamplesStore";
import { useDeveloperStore } from "../store/developerStore";
import { useSshSettingsStore } from "../store/sshSettingsStore";
import { usePrinterStore } from "../store/printerStore";
import type { MoonrakerMachineUpdateStatus } from "../moonraker/types";
import { userFacingTechnicalSummary } from "../lib/userFacingTechnicalSummary";
import { HubUpdatesPanel } from "./HubUpdatesPanel";

type HubTab =
  | "details"
  | "updates"
  | "diagnostics"
  | "hardware"
  | "health"
  | "baseline"
  | "ssh";

export function PrinterOpsHub({ printer }: { printer: SavedPrinter }) {
  const { t } = useTranslation();
  const reduceMotion = useReducedMotion();
  const updatePrinter = usePrinterStore((s) => s.updatePrinter);
  const developerMode = useDeveloperStore((s) => s.developerMode);
  const sshG = useSshSettingsStore();
  const baseline = useBaselineStore();
  const recordNetworkSample = useHealthSamplesStore((s) => s.recordNetworkSample);
  const healthSamples = useHealthSamplesStore(
    (s) => s.byPrinterId[printer.id] ?? EMPTY_NETWORK_SAMPLES,
  );

  const [tab, setTab] = useState<HubTab>("details");
  const [systemInfo, setSystemInfo] = useState<unknown>(null);
  const [updateStatus, setUpdateStatus] = useState<MoonrakerMachineUpdateStatus | null>(null);
  const [diagMoon, setDiagMoon] = useState<string>("");
  const [diagSsh, setDiagSsh] = useState<string>("");
  const [logText, setLogText] = useState<string>("");
  const [busy, setBusy] = useState<string | null>(null);
  const [pw, setPw] = useState("");
  const [identityHint, setIdentityHint] = useState<string>("");
  const [probeGlobal, setProbeGlobal] = useState<SshProbeKind | null>(null);
  const [probeEffective, setProbeEffective] = useState<SshProbeKind | null>(null);
  const [sshEstablishedFlash, setSshEstablishedFlash] = useState<string | null>(null);

  const hint = useMemo(() => {
    const m = matchHostSshHint(systemInfo);
    return m ? { id: m.id, suggestedUsername: m.suggestedUsername } : null;
  }, [systemInfo]);

  const effective = useMemo(
    () =>
      resolveEffectiveSsh(printer, {
        defaultSshUser: sshG.defaultSshUser,
        defaultSshPort: sshG.defaultSshPort,
        applyHostHintToUsername: sshG.applyHostHintToUsername,
      }, hint),
    [printer, sshG.defaultSshPort, sshG.defaultSshUser, sshG.applyHostHintToUsername, hint],
  );

  const globalEffective = useMemo(
    () =>
      resolveEffectiveSshGlobalsOnly(printer, {
        defaultSshUser: sshG.defaultSshUser,
        defaultSshPort: sshG.defaultSshPort,
        applyHostHintToUsername: sshG.applyHostHintToUsername,
      }, hint),
    [printer, sshG.defaultSshPort, sshG.defaultSshUser, sshG.applyHostHintToUsername, hint],
  );

  const runSshProbes = useCallback(async () => {
    if (!isTauri()) {
      setProbeGlobal(null);
      setProbeEffective(null);
      return;
    }
    const gEp = {
      host: globalEffective.host,
      port: globalEffective.port,
      user: globalEffective.user,
    };
    const eEp = { host: effective.host, port: effective.port, user: effective.user };
    const [g, e] = await Promise.all([
      invokeSshProbe(gEp).catch((): SshProbeKind => "unreachable"),
      invokeSshProbe(eEp).catch((): SshProbeKind => "unreachable"),
    ]);
    if (g !== null) {
      setProbeGlobal(g);
    }
    if (e !== null) {
      setProbeEffective(e);
    }
  }, [
    globalEffective.host,
    globalEffective.port,
    globalEffective.user,
    effective.host,
    effective.port,
    effective.user,
  ]);

  useEffect(() => {
    void runSshProbes();
  }, [runSshProbes]);

  useEffect(() => {
    if (!sshEstablishedFlash) {
      return;
    }
    const id = window.setTimeout(() => setSshEstablishedFlash(null), 4500);
    return () => window.clearTimeout(id);
  }, [sshEstablishedFlash]);

  /** Per-printer SSH overrides only when login with global defaults (Moonraker host + app defaults) fails. */
  const showSshOverridesTrigger = !isTauri() || probeGlobal !== "ok";

  const loadMoonrakerMeta = useCallback(async () => {
    try {
      const [si, us] = await Promise.all([
        fetchMachineSystemInfo(printer.baseUrl, printer.apiKey).catch(() => null),
        fetchMachineUpdateStatus(printer.baseUrl, printer.apiKey).catch(() => null),
      ]);
      setSystemInfo(si);
      setUpdateStatus(us);
      setDiagMoon(JSON.stringify({ machine_system_info: si, machine_update_status: us }, null, 2));
    } catch (e) {
      setDiagMoon(e instanceof Error ? e.message : String(e));
    }
  }, [printer.apiKey, printer.baseUrl]);

  useEffect(() => {
    void loadMoonrakerMeta();
  }, [loadMoonrakerMeta]);

  const onEnsureIdentity = async () => {
    if (!isTauri()) {
      setIdentityHint(t("hub.sshDesktopOnly"));
      return;
    }
    setBusy("id");
    try {
      const id = await invokeSshEnsureIdentity();
      setIdentityHint(id?.publicKeyOpenssh?.slice(0, 80) ?? "");
    } catch (e) {
      setIdentityHint(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const onDeployKey = async () => {
    if (!isTauri()) {
      return;
    }
    setBusy("key");
    try {
      const r = await invokeSshDeployKey(
        { host: effective.host, port: effective.port, user: effective.user },
        pw,
      );
      if (r.ok) {
        updatePrinter(printer.id, { sshKeyInstalled: true });
        void runSshProbes();
      }
      setIdentityHint(`${r.host}: ${r.message}`);
    } catch (e) {
      setIdentityHint(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
      setPw("");
    }
  };

  const onDiagnostics = async () => {
    setBusy("diag");
    setDiagSsh("");
    try {
      await loadMoonrakerMeta();
      let viaMoon = "";
      try {
        const tail = await tryFetchKlippyLogTail(printer.baseUrl, printer.apiKey);
        if (tail) {
          viaMoon = `\n\n=== klippy.log (Moonraker HTTP tail) ===\n${tail.slice(-40_000)}`;
          setLogText((prev) => (tail.length > prev.length ? tail : prev));
        }
      } catch {
        /* optional */
      }
      setDiagMoon((m) => m + viaMoon);

      if (isTauri()) {
        const ex = await invokeSshExecPreset(
          { host: effective.host, port: effective.port, user: effective.user },
          "diagnostics_core",
        );
        setDiagSsh(`${ex.stdout}\n${ex.stderr ? `\nstderr:\n${ex.stderr}` : ""}`);
        recordNetworkSample(printer.id, ex.stdout);
      } else {
        setDiagSsh(t("hub.sshDesktopOnly"));
      }
    } catch (e) {
      setDiagSsh(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const onLoadLog = async () => {
    setBusy("log");
    try {
      const tail = await tryFetchKlippyLogTail(printer.baseUrl, printer.apiKey);
      if (tail) {
        setLogText(tail);
      } else if (isTauri()) {
        const ex = await invokeSshExecPreset(
          { host: effective.host, port: effective.port, user: effective.user },
          "klippy_log_tail",
        );
        setLogText(ex.stdout);
      }
    } catch (e) {
      setLogText(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const extracted = useMemo(() => extractResolvedConfigFromKlipperLog(logText), [logText]);
  const sections = useMemo(
    () => (extracted.ok ? parseKlipperConfigSections(extracted.text) : []),
    [extracted],
  );
  const hardware = useMemo(() => summarizeHardware(sections), [sections]);
  const findings = useMemo(() => analyzeKlipperLogLines(logText), [logText]);

  const trend =
    healthSamples.length >= 2
      ? compareNetworkSamples(
          healthSamples[healthSamples.length - 2]!.raw,
          healthSamples[healthSamples.length - 1]!.raw,
        )
      : null;

  const sshIdentityCompact = useMemo(() => {
    if (!identityHint || developerMode) {
      return null;
    }
    return userFacingTechnicalSummary(identityHint);
  }, [identityHint, developerMode]);

  const tabs: { id: HubTab; label: string }[] = [
    { id: "details", label: t("hub.tabDetails") },
    { id: "updates", label: t("hub.tabUpdates") },
    { id: "diagnostics", label: t("hub.tabDiagnostics") },
    { id: "hardware", label: t("hub.tabHardware") },
    { id: "health", label: t("hub.tabHealth") },
    { id: "baseline", label: t("hub.tabBaseline") },
    { id: "ssh", label: t("hub.tabSsh") },
  ];

  const tabContent = (
    <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain py-2 pr-1">
      {tab === "details" ? (
        <p className="text-sm text-[var(--text-secondary)]">{t("hub.detailsPlaceholder")}</p>
      ) : null}

      {tab === "ssh" ? (
        <div className="space-y-3 text-sm text-[var(--text-primary)]">
          {sshEstablishedFlash ? (
            <p className="rounded-xl border border-[var(--success)]/35 bg-[var(--success)]/15 px-3 py-2 text-sm text-[var(--text-primary)]">
              {sshEstablishedFlash}
            </p>
          ) : null}
          <p className="text-[var(--text-secondary)]">{t("hub.sshIntro")}</p>
          {probeEffective === "authFailed" ? (
            <div className="space-y-2 rounded-xl border border-amber-400/40 bg-amber-400/10 p-3 text-xs">
              <p className="font-medium text-[var(--text-primary)]">{t("hub.sshAuthFailedHint")}</p>
              <label className="block text-[var(--text-secondary)]" htmlFor="hub-ssh-user">
                {t("hub.sshUsernameField")}
              </label>
              <input
                className="w-full rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] px-3 py-2 text-sm"
                id="hub-ssh-user"
                onChange={(e) =>
                  updatePrinter(printer.id, { sshUser: e.target.value.trim() || undefined })
                }
                value={printer.sshUser ?? ""}
              />
            </div>
          ) : null}
          <div className="rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)]/40 p-3 font-mono text-xs">
            <div>host: {effective.host}</div>
            <div>
              port: {effective.port} · user: {effective.user}
            </div>
            {effective.matchedHintId ? (
              <div className="mt-1 text-[var(--text-secondary)]">
                {t("hub.sshHintApplied", { id: effective.matchedHintId })}
              </div>
            ) : null}
          </div>
          <button
            className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            disabled={busy !== null}
            onClick={() => void onEnsureIdentity()}
            type="button"
          >
            {t("hub.ensureIdentity")}
          </button>
          {identityHint ? (
            developerMode ? (
              <pre className="max-h-32 overflow-auto whitespace-pre-wrap rounded-lg border border-[var(--glass-border)] p-2 text-[11px]">
                {identityHint}
              </pre>
            ) : sshIdentityCompact ? (
              <div className="rounded-lg border border-[var(--glass-border)] bg-[var(--glass-bg)]/40 p-2 text-xs text-[var(--text-primary)]">
                <p className="whitespace-pre-wrap break-words">
                  {sshIdentityCompact.line || "—"}
                </p>
                {sshIdentityCompact.hasMore ? (
                  <p className="mt-1 text-[10px] text-[var(--text-secondary)]">
                    {t("hub.devModeForTechnicalDetails")}
                  </p>
                ) : null}
              </div>
            ) : null
          ) : null}
          <div className="space-y-2">
            <label className="text-xs text-[var(--text-secondary)]" htmlFor="hub-ssh-pw">
              {t("hub.oneTimePassword")}
            </label>
            <input
              autoComplete="off"
              className="w-full rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] px-3 py-2 text-sm"
              id="hub-ssh-pw"
              onChange={(e) => setPw(e.target.value)}
              type="password"
              value={pw}
            />
            <button
              className="rounded-xl border border-[var(--glass-border)] px-4 py-2 text-sm transition-all hover:brightness-105 disabled:opacity-50"
              disabled={busy !== null || !pw}
              onClick={() => void onDeployKey()}
              type="button"
            >
              {t("hub.deployKeyThisPrinter")}
            </button>
          </div>
        </div>
      ) : null}

      {tab === "diagnostics" ? (
        <div className="space-y-2">
          <button
            className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            disabled={busy !== null}
            onClick={() => void onDiagnostics()}
            type="button"
          >
            {t("hub.collectDiagnostics")}
          </button>
          {findings.length > 0 ? (
            <div className="rounded-xl border border-[var(--warning)]/40 bg-[var(--warning)]/10 p-2 text-xs">
              <p className="font-medium text-[var(--text-primary)]">{t("hub.logFindingsTitle")}</p>
              <ul className="mt-1 list-inside list-disc space-y-1 text-[var(--text-secondary)]">
                {findings.map((f) => (
                  <li key={f.code + (f.excerpt ?? "")}>
                    {t(f.messageKey)}
                    {f.excerpt && developerMode ? ` — ${f.excerpt}` : ""}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {developerMode ? (
            <>
              <details className="rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)]/30 p-2">
                <summary className="cursor-pointer text-sm">{t("hub.moonrakerJson")}</summary>
                <pre className="mt-2 max-h-48 overflow-auto text-[11px]">{diagMoon || "—"}</pre>
              </details>
              <details className="rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)]/30 p-2">
                <summary className="cursor-pointer text-sm">{t("hub.sshOutput")}</summary>
                <pre className="mt-2 max-h-64 overflow-auto text-[11px]">{diagSsh || "—"}</pre>
              </details>
            </>
          ) : null}
        </div>
      ) : null}

      {tab === "updates" ? (
        <HubUpdatesPanel
          apiKey={printer.apiKey}
          baseUrl={printer.baseUrl}
          developerMode={developerMode}
          onUpdateStatus={setUpdateStatus}
          sshEndpoint={{
            host: effective.host,
            port: effective.port,
            user: effective.user,
          }}
          sshOk={isTauri() && probeEffective === "ok"}
          systemInfo={systemInfo}
          updateStatus={updateStatus}
        />
      ) : null}

      {tab === "hardware" ? (
        <div className="space-y-2 text-sm">
          <button
            className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            disabled={busy !== null}
            onClick={() => void onLoadLog()}
            type="button"
          >
            {t("hub.loadKlipperLog")}
          </button>
          {!extracted.ok ? (
            <p className="text-[var(--text-secondary)]">{t("hub.configNotExtracted")}</p>
          ) : (
            <>
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="rounded-xl border border-[var(--glass-border)] p-2">
                  <p className="text-xs font-medium text-[var(--text-secondary)]">MCU</p>
                  <ul className="mt-1 space-y-1 text-[11px]">
                    {hardware.mcus.map((m) => (
                      <li key={m.section}>
                        {m.section}: {m.serial ?? m.canbusUuid ?? "—"}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-xl border border-[var(--glass-border)] p-2">
                  <p className="text-xs font-medium text-[var(--text-secondary)]">
                    {t("hub.tempSensors")}
                  </p>
                  <ul className="mt-1 space-y-1 text-[11px]">
                    {hardware.tempSensors.map((s) => (
                      <li key={s.section}>
                        {s.section}: {s.sensorType ?? "—"}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              {developerMode ? (
                <details className="rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)]/30 p-2">
                  <summary>{t("hub.resolvedConfigRaw")}</summary>
                  <pre className="mt-2 max-h-64 overflow-auto text-[11px]">{extracted.text}</pre>
                </details>
              ) : null}
            </>
          )}
        </div>
      ) : null}

      {tab === "health" ? (
        <div className="space-y-2 text-sm text-[var(--text-primary)]">
          <p className="text-[var(--text-secondary)]">{t("hub.healthIntro")}</p>
          {trend ? (
            <p
              className={
                trend.kind === "warn" ? "text-[var(--warning)]" : "text-[var(--success)]"
              }
            >
              {t(trend.messageKey)}
              {trend.kind === "warn" && trend.detail && developerMode ? ` (${trend.detail})` : ""}
            </p>
          ) : (
            <p className="text-[var(--text-secondary)]">{t("hub.healthNeedSamples")}</p>
          )}
          <p className="text-[11px] text-[var(--text-secondary)]">
            {t("hub.healthSamples", { count: healthSamples.length })}
          </p>
        </div>
      ) : null}

      {tab === "baseline" ? (
        <div className="space-y-2 text-sm">
          <p className="text-[var(--text-secondary)]">{t("hub.baselineIntro")}</p>
          <p className="text-xs text-[var(--text-secondary)]">
            {t("hub.baselineProfile", { name: baseline.profileName || "—" })}
          </p>
          <button
            className="rounded-xl border border-[var(--glass-border)] px-4 py-2 text-sm disabled:opacity-50"
            disabled={!extracted.ok}
            onClick={() => baseline.setConfigText(extracted.ok ? extracted.text : "")}
            type="button"
          >
            {t("hub.baselineCaptureFromPrinter")}
          </button>
          <button
            className="ml-2 rounded-xl border border-[var(--glass-border)] px-4 py-2 text-sm opacity-50"
            disabled
            type="button"
          >
            {t("hub.baselineCompareSoon")}
          </button>
        </div>
      ) : null}
    </div>
  );

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col px-4 pb-4 pt-2">
      <div className="mb-3 flex shrink-0 flex-wrap items-center gap-2 border-b border-[var(--glass-border)]/50 pb-3">
        {showSshOverridesTrigger ? (
          <Popover.Root>
            <Popover.Trigger asChild>
              <button
                aria-label={t("printer.sshOverrides")}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] text-[var(--text-primary)] transition-all hover:brightness-105"
                type="button"
              >
                <KeyRound className="h-5 w-5" strokeWidth={1.75} />
              </button>
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Content
                className="z-[240] w-[min(100vw-2rem,20rem)] rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-bg)] p-4 shadow-[var(--card-shadow)] backdrop-blur-xl"
                collisionPadding={12}
                sideOffset={8}
              >
                <p className="text-xs font-medium text-[var(--text-secondary)]">
                  {t("printer.sshOverridesTitle")}
                </p>
                <div className="mt-2 space-y-2">
                  <input
                    className="w-full rounded-lg border border-[var(--glass-border)] bg-white/40 px-2 py-1.5 text-xs dark:bg-black/30"
                    onChange={(e) => updatePrinter(printer.id, { sshHost: e.target.value || undefined })}
                    placeholder={t("printer.sshHostPlaceholder")}
                    value={printer.sshHost ?? ""}
                  />
                  <input
                    className="w-full rounded-lg border border-[var(--glass-border)] bg-white/40 px-2 py-1.5 text-xs dark:bg-black/30"
                    onChange={(e) =>
                      updatePrinter(printer.id, {
                        sshPort: e.target.value ? Number(e.target.value) : undefined,
                      })
                    }
                    placeholder="22"
                    type="number"
                    value={printer.sshPort ?? ""}
                  />
                  <input
                    className="w-full rounded-lg border border-[var(--glass-border)] bg-white/40 px-2 py-1.5 text-xs dark:bg-black/30"
                    onChange={(e) => updatePrinter(printer.id, { sshUser: e.target.value || undefined })}
                    placeholder={t("printer.sshUserPlaceholder")}
                    value={printer.sshUser ?? ""}
                  />
                </div>
                <Popover.Close className="mt-3 w-full rounded-lg bg-[var(--accent)] py-2 text-xs font-medium text-white">
                  {t("settings.close")}
                </Popover.Close>
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>
        ) : null}

        <h1 className="min-w-0 flex-1 truncate text-lg font-semibold text-[var(--text-primary)]">
          {printer.displayName ?? effective.host}
        </h1>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-2">
        <div className="flex flex-wrap gap-1.5">
          {tabs.map((x) => {
            const isActive = tab === x.id;
            if (x.id === "ssh") {
              const suffixBorder = isActive ? "border-white/25" : "border-[var(--glass-border)]/60";
              const suffix =
                isTauri() && probeEffective !== null ? (
                  probeEffective === "ok" ? (
                    <span
                      className={`inline-flex w-8 shrink-0 items-center justify-center border-l ${suffixBorder} bg-[var(--success)]`}
                      title={t("hub.sshProbeOk")}
                    >
                      <Check aria-hidden className="size-3.5 text-white" strokeWidth={2.5} />
                    </span>
                  ) : probeEffective === "authFailed" ? (
                    <span
                      className={`inline-flex w-8 shrink-0 items-center justify-center border-l ${suffixBorder} bg-amber-500`}
                      title={t("hub.sshProbeAuthFailed")}
                    >
                      <AlertTriangle aria-hidden className="size-3.5 text-white" strokeWidth={2.25} />
                    </span>
                  ) : (
                    <span
                      className={`inline-flex w-8 shrink-0 items-center justify-center border-l ${suffixBorder} bg-[var(--warning)]`}
                      title={t("hub.sshProbeUnreachable")}
                    >
                      <X aria-hidden className="size-3.5 text-white" strokeWidth={2.5} />
                    </span>
                  )
                ) : isTauri() ? (
                  <span
                    className={`inline-flex w-8 shrink-0 items-center justify-center border-l ${suffixBorder} bg-black/10 dark:bg-white/10`}
                  >
                    <span className="size-2 animate-pulse rounded-full bg-[var(--text-secondary)]/50" />
                  </span>
                ) : null;
              return (
                <button
                  className={[
                    "inline-flex min-h-[34px] items-stretch overflow-hidden rounded-xl text-xs font-medium transition-all duration-300",
                    isActive
                      ? "bg-[var(--accent)] text-white shadow-md"
                      : "border border-[var(--glass-border)]/60 bg-[var(--glass-bg)]/50 text-[var(--text-primary)] hover:brightness-105",
                  ].join(" ")}
                  key={x.id}
                  onClick={() => {
                    setTab(x.id);
                    if (probeEffective === "ok") {
                      setSshEstablishedFlash(t("hub.sshConnectionEstablished"));
                    }
                  }}
                  type="button"
                >
                  <span className="flex items-center px-3 py-1.5">{x.label}</span>
                  {suffix}
                </button>
              );
            }
            return (
              <button
                className={[
                  "rounded-xl px-3 py-1.5 text-xs font-medium transition-all duration-300",
                  isActive
                    ? "bg-[var(--accent)] text-white shadow-md"
                    : "border border-[var(--glass-border)]/60 bg-[var(--glass-bg)]/50 text-[var(--text-primary)] hover:brightness-105",
                ].join(" ")}
                key={x.id}
                onClick={() => setTab(x.id)}
                type="button"
              >
                {x.label}
              </button>
            );
          })}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            animate={{ opacity: 1, x: 0 }}
            className="flex min-h-0 flex-1 flex-col"
            exit={reduceMotion ? undefined : { opacity: 0, x: -8 }}
            initial={false}
            key={tab}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            {tabContent}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
