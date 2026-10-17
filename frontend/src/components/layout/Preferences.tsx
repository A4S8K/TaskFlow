import { useTranslation } from "react-i18next";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme, type Theme } from "../../contexts/ThemeContext";
import { languageOptions } from "../../i18n";
import type { Language } from "../../types";

export function Preferences() {
  const { t, i18n } = useTranslation();
  const { language } = useAuth();
  const { theme, setTheme } = useTheme();
  return (
    <div className="preferences">
      <select
        aria-label={t("common.language")}
        value={i18n.resolvedLanguage}
        onChange={(e) => void language(e.target.value as Language)}
      >
        {languageOptions.map((l) => (
          <option key={l.value} value={l.value}>
            {l.label}
          </option>
        ))}
      </select>
      <select
        aria-label={t("common.theme")}
        value={theme}
        onChange={(e) => setTheme(e.target.value as Theme)}
      >
        {(["light", "dark", "system"] as const).map((v) => (
          <option key={v} value={v}>
            {t(`common.${v}`)}
          </option>
        ))}
      </select>
    </div>
  );
}
