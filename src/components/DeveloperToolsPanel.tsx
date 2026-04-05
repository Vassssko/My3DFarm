import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  collectDiagnosticsSnapshot,
  collectFullDiagnosticBundle,
  collectMy3dfarmLocalStorageDump,
  copyTextToClipboard,
} from "../lib/diagnostics";
import { clearDebugEvents, getDebugEvents } from "../lib/debugRingBuffer";

export function DeveloperToolsPanel() {
  const { t } = useTranslation();
  const [status, setStatus] = useState<string | null>(null);

  const flash = useCallback((key: string) => {
    setStatus(t(key));
    setTimeout(() => setStatus(null), 2500);
  }, [t]);

  const onCopyDiagnostics = async () => {
    await copyTextToClipboard(JSON.stringify(collectDiagnosticsSnapshot(), null, 2));
    flash("settings.devCopiedDiagnostics");
  };

  const onCopyStorage = async () => {
    await copyTextToClipboard(JSON.stringify(collectMy3dfarmLocalStorageDump(), null, 2));
    flash("settings.devCopiedStorage");
  };

  const onCopyFull = async () => {
    await copyTextToClipboard(JSON.stringify(collectFullDiagnosticBundle(), null, 2));
    flash("settings.devCopiedFull");
  };

  const onClearLog = () => {
    clearDebugEvents();
    flash("settings.devClearedLog");
  };

  const eventCount = getDebugEvents().length;

  return (
    <div className="mt-4 space-y-3 border-t border-[var(--glass-border)] pt-4">
      <p className="text-xs font-medium text-[var(--text-secondary)]">{t("settings.devToolsTitle")}</p>
      <p className="text-[11px] leading-relaxed text-[var(--text-secondary)]">{t("settings.devToolsHint")}</p>
      <div className="flex flex-col gap-2">
        <button
          className="rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] px-3 py-2 text-left text-xs text-[var(--text-primary)] transition-all hover:brightness-105"
          onClick={() => void onCopyFull()}
          type="button"
        >
          {t("settings.devCopyFullBundle")}
        </button>
        <button
          className="rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] px-3 py-2 text-left text-xs text-[var(--text-primary)] transition-all hover:brightness-105"
          onClick={() => void onCopyDiagnostics()}
          type="button"
        >
          {t("settings.devCopyDiagnostics")}
        </button>
        <button
          className="rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] px-3 py-2 text-left text-xs text-[var(--text-primary)] transition-all hover:brightness-105"
          onClick={() => void onCopyStorage()}
          type="button"
        >
          {t("settings.devCopyStorage")}
        </button>
        <button
          className="rounded-xl border border-[var(--warning)]/40 bg-[var(--warning)]/10 px-3 py-2 text-left text-xs text-[var(--warning)] transition-all hover:bg-[var(--warning)]/20"
          onClick={onClearLog}
          type="button"
        >
          {t("settings.devClearMoonrakerLog", { count: eventCount })}
        </button>
      </div>
      {status ? (
        <p className="text-[11px] text-[var(--success)]" role="status">
          {status}
        </p>
      ) : null}
    </div>
  );
}
