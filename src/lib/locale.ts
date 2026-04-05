const SUPPORTED = ["ru", "en", "de", "zh"] as const;
export type AppLocale = (typeof SUPPORTED)[number];

export const LOCALE_STORAGE_KEY = "my3dfarm-locale";

/** First supported language from OS / browser (navigator.languages). */
export function detectOsLanguage(): AppLocale {
  const list = navigator.languages?.length
    ? [...navigator.languages]
    : [navigator.language];
  for (const raw of list) {
    if (!raw) {
      continue;
    }
    const lower = raw.toLowerCase();
    const base = lower.split("-")[0] ?? lower;
    if ((SUPPORTED as readonly string[]).includes(base)) {
      return base as AppLocale;
    }
    if ((SUPPORTED as readonly string[]).includes(lower)) {
      return lower as AppLocale;
    }
  }
  return "ru";
}

export function hasLocaleOverride(): boolean {
  return getLocaleOverride() !== null;
}

export function getLocaleOverride(): AppLocale | null {
  const v = localStorage.getItem(LOCALE_STORAGE_KEY);
  if (v && (SUPPORTED as readonly string[]).includes(v)) {
    return v as AppLocale;
  }
  return null;
}

export function setLocaleOverride(locale: AppLocale): void {
  localStorage.setItem(LOCALE_STORAGE_KEY, locale);
}

export function clearLocaleOverride(): void {
  localStorage.removeItem(LOCALE_STORAGE_KEY);
}
