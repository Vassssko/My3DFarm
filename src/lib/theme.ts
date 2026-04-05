export type ThemeMode = "system" | "light" | "dark";

const STORAGE_KEY = "my3dfarm-theme";

export function getStoredThemeMode(): ThemeMode {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw === "light" || raw === "dark" || raw === "system") {
    return raw;
  }
  return "system";
}

export function setStoredThemeMode(mode: ThemeMode): void {
  if (mode === "system") {
    localStorage.removeItem(STORAGE_KEY);
  } else {
    localStorage.setItem(STORAGE_KEY, mode);
  }
}

/** Apply `.dark` on `<html>` from stored preference or `prefers-color-scheme`. */
export function applyThemeClass(): void {
  const mode = getStoredThemeMode();
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const dark =
    mode === "dark" || (mode === "system" && prefersDark);
  document.documentElement.classList.toggle("dark", dark);
}
