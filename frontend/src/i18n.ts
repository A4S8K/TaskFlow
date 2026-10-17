import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en/translation.json";
import ru from "./locales/ru/translation.json";
import kk from "./locales/kk/translation.json";

export const supportedLanguages = ["en", "ru", "kk"] as const;
export type Language = (typeof supportedLanguages)[number];
export const LANGUAGE_STORAGE_KEY = "taskflow-language";
export const languageOptions: ReadonlyArray<{
  value: Language;
  label: string;
  short: string;
}> = [
  { value: "en", label: "English", short: "EN" },
  { value: "ru", label: "Русский", short: "RU" },
  { value: "kk", label: "Қазақша", short: "KZ" },
];

export function isLanguage(value: unknown): value is Language {
  return (
    typeof value === "string" && supportedLanguages.includes(value as Language)
  );
}

function readStoredLanguage(): Language {
  try {
    const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    return isLanguage(stored) ? stored : "en";
  } catch {
    // Storage can be unavailable in private browsing, SSR, or restricted embeds.
    return "en";
  }
}

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    ru: { translation: ru },
    kk: { translation: kk },
  },
  lng: readStoredLanguage(),
  fallbackLng: "en",
  supportedLngs: [...supportedLanguages],
  load: "languageOnly",
  interpolation: { escapeValue: false },
  returnNull: false,
});

function applyDocumentLanguage(language: string): void {
  const normalized = language.split("-")[0];
  if (!isLanguage(normalized)) return;
  if (typeof document !== "undefined")
    document.documentElement.lang = normalized;
  try {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, normalized);
  } catch {
    // Language switching remains available even when storage is disabled.
  }
}

i18n.on("languageChanged", applyDocumentLanguage);
applyDocumentLanguage(i18n.resolvedLanguage ?? i18n.language ?? "en");

export default i18n;
