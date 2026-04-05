import * as Dialog from "@radix-ui/react-dialog";
import { Settings } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import i18n from "../i18n";
import { hostFromMoonrakerBaseUrl, resolveEffectiveSsh } from "../lib/effectiveSsh";
import { isTauri } from "../lib/isTauri";
import { invokeSshDeployKey, invokeSshEnsureIdentity } from "../lib/sshInvoke";
import {
  clearLocaleOverride,
  detectOsLanguage,
  getLocaleOverride,
  setLocaleOverride,
  type AppLocale,
} from "../lib/locale";
import { applyThemeClass, getStoredThemeMode, setStoredThemeMode, type ThemeMode } from "../lib/theme";
import { useBaselineStore } from "../store/baselineStore";
import { useDeveloperStore } from "../store/developerStore";
import { useFarmStore } from "../store/farmStore";
import { usePrinterStore } from "../store/printerStore";
import { useSshSettingsStore } from "../store/sshSettingsStore";
import { DeveloperToolsPanel } from "./DeveloperToolsPanel";
import { MassKeyDeployFeed, type MassDeployFeedItem } from "./MassKeyDeployFeed";
import { Checkbox } from "./ui/Checkbox";

const LOCALES: { code: AppLocale; labelKey: string }[] = [
  { code: "ru", labelKey: "settings.langRu" },
  { code: "en", labelKey: "settings.langEn" },
  { code: "de", labelKey: "settings.langDe" },
  { code: "zh", labelKey: "settings.langZh" },
];

export function AppSettings() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [langValue, setLangValue] = useState<"auto" | AppLocale>("auto");
  const [themeValue, setThemeValue] = useState<ThemeMode>("system");
  const farmName = useFarmStore((s) => s.farmName);
  const setFarmName = useFarmStore((s) => s.setFarmName);
  const developerMode = useDeveloperStore((s) => s.developerMode);
  const setDeveloperMode = useDeveloperStore((s) => s.setDeveloperMode);
  const [farmDraft, setFarmDraft] = useState(farmName);
  const sshSettings = useSshSettingsStore();
  const printers = usePrinterStore((s) => s.printers);
  const updatePrinter = usePrinterStore((s) => s.updatePrinter);
  const baseline = useBaselineStore();
  const [massPw, setMassPw] = useState("");
  const [massLog, setMassLog] = useState("");
  const [massDeployFeed, setMassDeployFeed] = useState<MassDeployFeedItem[]>([]);
  const [sshBusy, setSshBusy] = useState(false);

  const syncFromStorage = useCallback(() => {
    const o = getLocaleOverride();
    setLangValue(o ?? "auto");
    setThemeValue(getStoredThemeMode());
  }, []);

  useEffect(() => {
    if (open) {
      syncFromStorage();
      setFarmDraft(farmName);
    }
  }, [open, syncFromStorage, farmName]);

  const onLanguageChange = (v: string) => {
    if (v === "auto") {
      clearLocaleOverride();
      const os = detectOsLanguage();
      void i18n.changeLanguage(os);
      setLangValue("auto");
      return;
    }
    const code = v as AppLocale;
    setLocaleOverride(code);
    void i18n.changeLanguage(code);
    setLangValue(code);
  };

  const onThemeChange = (v: string) => {
    const mode = v as ThemeMode;
    setStoredThemeMode(mode);
    setThemeValue(mode);
    applyThemeClass();
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setFarmName(farmDraft);
    }
    setOpen(next);
  };

  return (
    <Dialog.Root onOpenChange={handleOpenChange} open={open}>
      <Dialog.Trigger asChild>
        <button
          aria-label={t("settings.open")}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] text-[var(--text-primary)] shadow-[var(--card-shadow)] backdrop-blur-xl transition-all duration-300 hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          type="button"
        >
          <Settings aria-hidden className="h-5 w-5" strokeWidth={1.75} />
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[210] bg-black/35 backdrop-blur-sm" />
        <Dialog.Content className="glass fixed left-1/2 top-1/2 z-[220] flex max-h-[min(90vh,44rem)] w-[min(100vw-2rem,56rem)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-[24px] border border-[var(--glass-border)] p-6 shadow-[var(--card-shadow)] transition-all duration-300">
          <Dialog.Title className="text-lg font-semibold text-[var(--text-primary)]">
            {t("settings.title")}
          </Dialog.Title>
          <Dialog.Description className="sr-only">{t("settings.description")}</Dialog.Description>

          <div className="mt-5 min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain pr-1">
            <div className="space-y-2">
              <label className="text-xs font-medium text-[var(--text-secondary)]" htmlFor="my3dfarm-farm-name">
                {t("settings.farmName")}
              </label>
              <input
                className="w-full rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none focus:ring-2 focus:ring-[var(--accent)]"
                id="my3dfarm-farm-name"
                maxLength={120}
                onChange={(e) => setFarmDraft(e.target.value)}
                placeholder={t("settings.farmNamePlaceholder")}
                type="text"
                value={farmDraft}
              />
              <p className="text-[11px] text-[var(--text-secondary)]">{t("settings.farmNameHint")}</p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-[var(--text-secondary)]" htmlFor="my3dfarm-lang">
                {t("settings.language")}
              </label>
              <select
                className="w-full rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none focus:ring-2 focus:ring-[var(--accent)]"
                id="my3dfarm-lang"
                onChange={(e) => onLanguageChange(e.target.value)}
                value={langValue}
              >
                <option value="auto">{t("settings.languageAuto")}</option>
                {LOCALES.map(({ code, labelKey }) => (
                  <option key={code} value={code}>
                    {t(labelKey)}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-[var(--text-secondary)]" htmlFor="my3dfarm-theme">
                {t("settings.theme")}
              </label>
              <select
                className="w-full rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none focus:ring-2 focus:ring-[var(--accent)]"
                id="my3dfarm-theme"
                onChange={(e) => onThemeChange(e.target.value)}
                value={themeValue}
              >
                <option value="system">{t("settings.themeSystem")}</option>
                <option value="light">{t("settings.themeLight")}</option>
                <option value="dark">{t("settings.themeDark")}</option>
              </select>
            </div>

            <div className="space-y-3 rounded-xl border border-[var(--glass-border)]/60 bg-[var(--glass-bg)]/40 p-3">
              <p className="text-sm font-medium text-[var(--text-primary)]">{t("settings.sshSection")}</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-xs text-[var(--text-secondary)]" htmlFor="ssh-default-user">
                    {t("settings.defaultSshUser")}
                  </label>
                  <input
                    className="w-full rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] px-3 py-2 text-sm"
                    id="ssh-default-user"
                    onChange={(e) => sshSettings.setDefaultSshUser(e.target.value)}
                    value={sshSettings.defaultSshUser}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-[var(--text-secondary)]" htmlFor="ssh-default-port">
                    {t("settings.defaultSshPort")}
                  </label>
                  <input
                    className="w-full rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] px-3 py-2 text-sm"
                    id="ssh-default-port"
                    onChange={(e) => sshSettings.setDefaultSshPort(Number(e.target.value) || 22)}
                    type="number"
                    value={sshSettings.defaultSshPort}
                  />
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Checkbox
                  checked={sshSettings.applyHostHintToUsername}
                  id="ssh-hint-username"
                  onCheckedChange={(on) => sshSettings.setApplyHostHintToUsername(Boolean(on))}
                />
                <label className="text-sm text-[var(--text-primary)]" htmlFor="ssh-hint-username">
                  {t("settings.applyHostHintUsername")}
                </label>
              </div>
              <p className="text-[11px] text-[var(--text-secondary)]">{t("settings.hostHintsBlurb")}</p>
              <button
                className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                disabled={sshBusy || !isTauri()}
                onClick={() => {
                  setSshBusy(true);
                  void invokeSshEnsureIdentity()
                    .then(() => setMassLog(t("settings.sshIdentityReady")))
                    .catch((e: unknown) =>
                      setMassLog(e instanceof Error ? e.message : String(e)),
                    )
                    .finally(() => setSshBusy(false));
                }}
                type="button"
              >
                {t("settings.ensureSshIdentity")}
              </button>
              {massLog ? (
                <p className="rounded-lg border border-[var(--glass-border)]/50 bg-[var(--glass-bg)]/30 px-2 py-1.5 text-[11px] text-[var(--text-primary)]">
                  {massLog}
                </p>
              ) : null}
            </div>

            <div className="space-y-2 rounded-xl border border-[var(--glass-border)]/60 bg-[var(--glass-bg)]/40 p-3">
              <p className="text-sm font-medium text-[var(--text-primary)]">{t("settings.massKeyTitle")}</p>
              <p className="text-[11px] text-[var(--text-secondary)]">{t("settings.massKeyHint")}</p>
              <input
                autoComplete="off"
                className="w-full rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] px-3 py-2 text-sm"
                onChange={(e) => setMassPw(e.target.value)}
                placeholder={t("settings.massKeyPasswordPlaceholder")}
                type="password"
                value={massPw}
              />
              <button
                className="rounded-xl border border-[var(--glass-border)] px-4 py-2 text-sm disabled:opacity-50"
                disabled={sshBusy || !massPw || printers.length === 0 || !isTauri()}
                onClick={() => {
                  setSshBusy(true);
                  setMassDeployFeed([]);
                  void (async () => {
                    try {
                      for (let i = 0; i < printers.length; i++) {
                        const p = printers[i]!;
                        const e = resolveEffectiveSsh(
                          p,
                          {
                            defaultSshUser: sshSettings.defaultSshUser,
                            defaultSshPort: sshSettings.defaultSshPort,
                            applyHostHintToUsername: false,
                          },
                          null,
                        );
                        const hostLabel =
                          p.displayName?.trim() || hostFromMoonrakerBaseUrl(p.baseUrl);
                        try {
                          const r = await invokeSshDeployKey(
                            { host: e.host, port: e.port, user: e.user },
                            massPw,
                          );
                          if (r.ok) {
                            updatePrinter(p.id, { sshKeyInstalled: true });
                          }
                          setMassDeployFeed((prev) => [
                            ...prev,
                            {
                              id: `${p.id}-${i}-${Date.now()}`,
                              sshHost: e.host,
                              hostLabel,
                              ok: r.ok,
                              message: r.message,
                            },
                          ]);
                        } catch (err) {
                          setMassDeployFeed((prev) => [
                            ...prev,
                            {
                              id: `${p.id}-${i}-err-${Date.now()}`,
                              sshHost: e.host,
                              hostLabel,
                              ok: false,
                              message: err instanceof Error ? err.message : String(err),
                            },
                          ]);
                        }
                      }
                      setMassPw("");
                    } catch (e: unknown) {
                      setMassDeployFeed((prev) => [
                        ...prev,
                        {
                          id: `fatal-${Date.now()}`,
                          sshHost: "—",
                          hostLabel: t("errors.network"),
                          ok: false,
                          message: e instanceof Error ? e.message : String(e),
                        },
                      ]);
                    } finally {
                      setSshBusy(false);
                    }
                  })();
                }}
                type="button"
              >
                {t("settings.massKeyRun")}
              </button>
              <MassKeyDeployFeed items={massDeployFeed} />
            </div>

            <div className="space-y-2 rounded-xl border border-[var(--glass-border)]/60 bg-[var(--glass-bg)]/40 p-3">
              <p className="text-sm font-medium text-[var(--text-primary)]">{t("settings.baselineSection")}</p>
              <input
                className="w-full rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] px-3 py-2 text-sm"
                onChange={(e) => baseline.setProfileName(e.target.value)}
                placeholder={t("settings.baselineProfilePlaceholder")}
                value={baseline.profileName}
              />
              <p className="text-[11px] text-[var(--text-secondary)]">{t("settings.baselineHint")}</p>
            </div>

            <div className="flex items-start gap-3 rounded-xl border border-[var(--glass-border)]/60 bg-[var(--glass-bg)]/50 p-3">
              <Checkbox
                checked={developerMode}
                id="my3dfarm-developer-mode"
                onCheckedChange={(on) => setDeveloperMode(on)}
              />
              <div className="min-w-0 flex-1">
                <label
                  className="text-sm font-medium text-[var(--text-primary)]"
                  htmlFor="my3dfarm-developer-mode"
                >
                  {t("settings.developerMode")}
                </label>
                <p className="mt-1 text-[11px] text-[var(--text-secondary)]">{t("settings.developerModeHint")}</p>
              </div>
            </div>

            {developerMode ? <DeveloperToolsPanel /> : null}
          </div>

          <Dialog.Close asChild>
            <button
              className="mt-4 w-full shrink-0 rounded-xl bg-[var(--accent)] py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
              type="button"
            >
              {t("settings.close")}
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
