import { useEffect } from "react";
import { AppShellHeader } from "./components/AppShellHeader";
import { PrinterDiscovery } from "./components/PrinterDiscovery";
import { PrinterList } from "./components/PrinterList";
import { applyThemeClass, getStoredThemeMode } from "./lib/theme";
import { usePrinterStore } from "./store/printerStore";
import { useUpstreamVersionsStore } from "./store/upstreamVersionsStore";

export default function App() {
  const printers = usePrinterStore((s) => s.printers);
  const setGridEditMode = usePrinterStore((s) => s.setGridEditMode);

  useEffect(() => {
    if (printers.length === 0) {
      setGridEditMode(false);
    }
  }, [printers.length, setGridEditMode]);

  useEffect(() => {
    /** Block native WebView/browser context menu app-wide until we ship a custom one. */
    const blockContextMenu = (e: Event) => {
      e.preventDefault();
    };
    document.addEventListener("contextmenu", blockContextMenu, { capture: true });
    return () => document.removeEventListener("contextmenu", blockContextMenu, { capture: true });
  }, []);

  useEffect(() => {
    void useUpstreamVersionsStore.getState().ensureFetched();
  }, []);

  useEffect(() => {
    applyThemeClass();
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (getStoredThemeMode() === "system") {
        applyThemeClass();
      }
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <AppShellHeader />
      <main className="flex min-h-0 flex-1 flex-col">
        {printers.length === 0 ? <PrinterDiscovery /> : <PrinterList />}
      </main>
    </div>
  );
}
