import { getDebugEvents } from "./debugRingBuffer";
import { isTauri } from "./isTauri";
import { getLocaleOverride } from "./locale";
import { getStoredThemeMode } from "./theme";
import { useDeveloperStore } from "../store/developerStore";
import { useFarmStore } from "../store/farmStore";
import { usePrinterStore } from "../store/printerStore";

export function collectMy3dfarmLocalStorageDump(): Record<string, string> {
  const out: Record<string, string> = {};
  if (typeof localStorage === "undefined") {
    return out;
  }
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith("my3dfarm")) {
      out[k] = localStorage.getItem(k) ?? "";
    }
  }
  return out;
}

export function collectDiagnosticsSnapshot() {
  const printers = usePrinterStore.getState().printers;
  const farmName = useFarmStore.getState().farmName;
  const developerMode = useDeveloperStore.getState().developerMode;
  return {
    collectedAt: new Date().toISOString(),
    app: {
      tauri: isTauri(),
      viteMode: import.meta.env.MODE,
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
    },
    ui: {
      theme: getStoredThemeMode(),
      localeOverride: getLocaleOverride(),
      developerMode,
    },
    farmName,
    printers: printers.map((p) => ({
      id: p.id,
      baseUrl: p.baseUrl,
      displayName: p.displayName,
      hasApiKey: Boolean(p.apiKey?.trim()),
    })),
    recentMoonrakerEvents: getDebugEvents(),
  };
}

export function collectFullDiagnosticBundle() {
  return {
    ...collectDiagnosticsSnapshot(),
    localStorageMy3dfarm: collectMy3dfarmLocalStorageDump(),
  };
}

export async function copyTextToClipboard(text: string): Promise<void> {
  await navigator.clipboard.writeText(text);
}
