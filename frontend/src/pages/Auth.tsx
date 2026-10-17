import { Link, useNavigate, Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { AuthForm } from "../components/auth/AuthForm";
import { Brand } from "../components/layout/Shell";
import { Preferences } from "../components/layout/Preferences";
import { useAuth } from "../contexts/AuthContext";
import { write } from "../api/resources";

export function AuthPage({ register = false }: { register?: boolean }) {
  const { t, i18n } = useTranslation();
  const { user, login } = useAuth();
  const navigate = useNavigate();
  if (user) return <Navigate to="/app" replace />;
  return (
    <div className="auth-layout">
      <aside className="auth-aside">
        <Brand />
        <div className="auth-aside-content">
          <h1 className="auth-aside-title">{t("auth.tagline")}</h1>
          <p className="auth-aside-description">{t("auth.brandDescription")}</p>
          {["featureProjects", "featureTasks", "featureTeam"].map((k) => (
            <p className="auth-feature" key={k}>
              ✓ {t(`auth.${k}`)}
            </p>
          ))}
        </div>
        <p>TaskFlow · 1.0</p>
      </aside>
      <section className="auth-content">
        <div className="auth-preferences">
          <Preferences />
        </div>
        <div className="auth-form">
          <h2 className="auth-heading">
            {t(register ? "auth.registerTitle" : "auth.loginTitle")}
          </h2>
          <p className="auth-subtitle">
            {t(register ? "auth.registerSubtitle" : "auth.loginSubtitle")}
          </p>
          <AuthForm
            mode={register ? "register" : "login"}
            onSubmit={async (values) => {
              if (register) {
                await write("post", "/auth/register", {
                  ...values,
                  preferred_language: i18n.resolvedLanguage,
                });
                toast.success(t("auth.registerSuccess"));
                navigate("/login");
              } else {
                await login(values.email, values.password);
                navigate("/app");
              }
            }}
          />
          <p className="auth-footer">
            {t(register ? "auth.hasAccount" : "auth.noAccount")}{" "}
            <Link to={register ? "/login" : "/register"}>
              {t(register ? "auth.login" : "auth.register")}
            </Link>
          </p>
          <p className="auth-session-note">{t("auth.sessionNotice")}</p>
        </div>
      </section>
    </div>
  );
}
