import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  ArrowRight,
  FolderKanban,
  Users,
  Globe,
  CheckCheck,
} from "lucide-react";
import { Brand } from "../components/layout/Shell";
import { Preferences } from "../components/layout/Preferences";

export function Landing() {
  const { t } = useTranslation();
  return (
    <div className="landing">
      <header>
        <Brand />
        <Preferences />
        <Link to="/login">{t("auth.login")}</Link>
      </header>
      <main>
        <div className="hero">
          <span className="eyebrow">{t("landing.eyebrow")}</span>
          <h1>{t("auth.tagline")}</h1>
          <p>{t("auth.brandDescription")}</p>
          <Link to="/register" className="hero-button">
            {t("auth.register")} <ArrowRight size={18} />
          </Link>
          <Link to="/login" className="hero-secondary">
            {t("auth.login")}
          </Link>
        </div>
        <section className="landing-product">
          <div className="product-head">
            <CheckCheck size={20} />
            <span>{t("landing.workspace")}</span>
            <span className="live-pill">{t("landing.threeLanguages")}</span>
          </div>
          <div className="feature-grid">
            {[
              [FolderKanban, "featureProjects"],
              [Users, "featureTeam"],
              [Globe, "featureTasks"],
            ].map(([Icon, key]) => {
              const Glyph = Icon as typeof Globe;
              return (
                <article key={String(key)}>
                  <Glyph size={28} />
                  <h2>{t(`auth.${key}`)}</h2>
                  <p>{t(`landing.${key}`)}</p>
                </article>
              );
            })}
          </div>
        </section>
      </main>
      <footer>
        © {new Date().getFullYear()} TaskFlow · {t("landing.footer")}
      </footer>
    </div>
  );
}
