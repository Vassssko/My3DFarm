import { ArrowLeft, Check, Pencil } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link, useLocation } from "react-router-dom";
import { useFarmStore } from "../store/farmStore";
import { usePrinterStore } from "../store/printerStore";
import { AppSettings } from "./AppSettings";

export function AppShellHeader() {
  const { t } = useTranslation();
  const location = useLocation();
  const farmName = useFarmStore((s) => s.farmName);
  const printers = usePrinterStore((s) => s.printers);
  const gridEditMode = usePrinterStore((s) => s.gridEditMode);
  const setGridEditMode = usePrinterStore((s) => s.setGridEditMode);
  const showEditFarm = printers.length > 0;
  const onPrinterHub = location.pathname.startsWith("/printer/");

  return (
    <header className="flex shrink-0 items-center justify-between gap-4 border-b border-[var(--glass-border)]/40 bg-[var(--glass-bg)]/30 px-6 py-3 backdrop-blur-xl">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        {onPrinterHub ? (
          <Link
            className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] px-3 py-2 text-sm font-medium text-[var(--text-primary)] transition-all duration-300 hover:brightness-105"
            to="/"
          >
            <ArrowLeft className="h-4 w-4" strokeWidth={2} />
            {t("header.backToFarm")}
          </Link>
        ) : null}
        <h1 className="min-w-0 truncate text-2xl font-semibold tracking-tight text-[var(--text-primary)]">
          {farmName}
        </h1>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        {showEditFarm && !onPrinterHub ? (
          <button
            className="inline-flex items-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-white shadow-md transition-all duration-300 hover:opacity-90"
            onClick={() => setGridEditMode(!gridEditMode)}
            type="button"
          >
            {gridEditMode ? (
              <>
                <Check className="h-4 w-4" strokeWidth={2.25} />
                {t("printer.doneEditing")}
              </>
            ) : (
              <>
                <Pencil className="h-4 w-4" strokeWidth={2} />
                {t("printer.editFarm")}
              </>
            )}
          </button>
        ) : null}
        <AppSettings />
      </div>
    </header>
  );
}
