import { Suspense, useEffect } from "react";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import { AppErrorBoundary } from "./components/AppErrorBoundary";
import { AppShellHeader } from "./components/AppShellHeader";
import { applyThemeClass, getStoredThemeMode } from "./lib/theme";
import { FarmPage } from "./routes/FarmPage";
import { PrinterHubPage } from "./routes/PrinterHubPage";
import { useUpstreamVersionsStore } from "./store/upstreamVersionsStore";

function RoutedMain() {
  const location = useLocation();
  return (
    <AppErrorBoundary key={location.pathname}>
      <Suspense
        fallback={
          <div className="flex flex-1 items-center justify-center p-6 text-sm text-[var(--text-secondary)]">
            Loading…
          </div>
        }
      >
        <Routes>
          <Route element={<FarmPage />} path="/" />
          <Route element={<PrinterHubPage />} path="/printer/:printerId" />
        </Routes>
      </Suspense>
    </AppErrorBoundary>
  );
}

export default function App() {
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
    <BrowserRouter>
      <div className="flex h-full min-h-0 flex-col">
        <AppShellHeader />
        <main className="flex min-h-0 flex-1 flex-col">
          <RoutedMain />
        </main>
      </div>
    </BrowserRouter>
  );
}
