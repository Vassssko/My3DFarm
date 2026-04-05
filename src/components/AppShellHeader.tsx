import { Check, Pencil } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useFarmStore } from "../store/farmStore";
import { usePrinterStore } from "../store/printerStore";
import { AppSettings } from "./AppSettings";

export function AppShellHeader() {
  const { t } = useTranslation();
  const farmName = useFarmStore((s) => s.farmName);
  const printers = usePrinterStore((s) => s.printers);
  const gridEditMode = usePrinterStore((s) => s.gridEditMode);
  const setGridEditMode = usePrinterStore((s) => s.setGridEditMode);
  const showEditFarm = printers.length > 0;

  return (
    <header className="flex shrink-0 items-center justify-between gap-4 border-b border-[var(--glass-border)]/40 bg-[var(--glass-bg)]/30 px-6 py-3 backdrop-blur-xl">
      <h1 className="min-w-0 truncate text-2xl font-semibold tracking-tight text-[var(--text-primary)]">
        {farmName}
      </h1>
      <div className="flex shrink-0 items-center gap-3">
        {showEditFarm ? (
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
