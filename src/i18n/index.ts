import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";

import de from "./locales/de.json";
import en from "./locales/en.json";
import ru from "./locales/ru.json";
import zh from "./locales/zh.json";

import { LOCALE_STORAGE_KEY } from "../lib/locale";

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      ru: { translation: ru },
      en: { translation: en },
      de: { translation: de },
      zh: { translation: zh },
    },
    fallbackLng: "ru",
    supportedLngs: ["ru", "en", "de", "zh"],
    load: "languageOnly",
    interpolation: { escapeValue: false },
    detection: {
      // Manual override in localStorage; otherwise OS / browser (`navigator`).
      order: ["localStorage", "navigator"],
      caches: [],
      lookupLocalStorage: LOCALE_STORAGE_KEY,
    },
  });

export default i18n;
