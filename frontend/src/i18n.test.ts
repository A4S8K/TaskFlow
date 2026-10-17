import { afterEach, describe, expect, it } from "vitest";
import i18n, { LANGUAGE_STORAGE_KEY } from "./i18n";
import en from "./locales/en/translation.json";
import ru from "./locales/ru/translation.json";
import kk from "./locales/kk/translation.json";

function keys(value: Record<string, unknown>, prefix = ""): string[] {
  return Object.entries(value).flatMap(([key, item]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof item === "object" && item !== null
      ? keys(item as Record<string, unknown>, path)
      : [path];
  });
}

describe("localization", () => {
  afterEach(async () => {
    await i18n.changeLanguage("en");
  });

  it("covers every English key in Russian and Kazakh", () => {
    const englishKeys = keys(en);
    expect(keys(ru)).toEqual(expect.arrayContaining(englishKeys));
    expect(keys(kk)).toEqual(expect.arrayContaining(englishKeys));
  });

  it("switches translations live and persists only a guest language preference", async () => {
    const english = i18n.t("nav.projects");
    await i18n.changeLanguage("ru");
    expect(i18n.t("nav.projects")).not.toBe(english);
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe("ru");
    expect(document.documentElement.lang).toBe("ru");
    await i18n.changeLanguage("kk");
    expect(i18n.t("nav.projects")).not.toBe(english);
    expect(document.documentElement.lang).toBe("kk");
  });
});
