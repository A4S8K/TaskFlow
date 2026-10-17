import { useTranslation } from "react-i18next";
import { useAuth } from "../contexts/AuthContext";
import { Preferences } from "../components/layout/Preferences";
import { Button } from "../components/ui/button";

export function SettingsPage() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">{t("settings.title")}</h1>
          <p className="page-subtitle">{t("settings.subtitle")}</p>
        </div>
      </div>
      <section className="panel settings-section">
        <h2>{t("settings.profile")}</h2>
        <dl className="profile-data">
          <dt>{t("settings.username")}</dt>
          <dd>{user?.username}</dd>
          <dt>{t("settings.email")}</dt>
          <dd>{user?.email}</dd>
        </dl>
        <p>{t("settings.profileReadOnly")}</p>
      </section>
      <section className="panel settings-section">
        <h2>{t("settings.preferences")}</h2>
        <p>{t("settings.languageDescription")}</p>
        <p>{t("settings.appearanceDescription")}</p>
        <Preferences />
      </section>
      <section className="panel settings-section">
        <h2>{t("settings.security")}</h2>
        <p>{t("settings.sessionDescription")}</p>
        <Button variant="outline" onClick={logout}>
          {t("nav.logout")}
        </Button>
      </section>
    </>
  );
}
