import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  CheckCheck,
  LayoutDashboard,
  FolderKanban,
  ListTodo,
  Settings,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../contexts/AuthContext";
import { Preferences } from "./Preferences";
import { Button } from "../ui/button";

export function Brand() {
  return (
    <NavLink to="/" className="brand">
      <span className="brand-mark">
        <CheckCheck size={22} />
      </span>
      TaskFlow<span className="brand-dot">.</span>
    </NavLink>
  );
}
export function Shell() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const links = [
    ["/app", "dashboard", LayoutDashboard],
    ["/app/projects", "projects", FolderKanban],
    ["/app/tasks", "myTasks", ListTodo],
    ["/app/settings", "settings", Settings],
  ] as const;
  return (
    <div className="app-shell">
      <a href="#main" className="skip-link">
        {t("common.skipToContent")}
      </a>
      {open && (
        <button
          className="mobile-backdrop"
          aria-label={t("common.closeMenu")}
          onClick={() => setOpen(false)}
        />
      )}
      <aside className={`sidebar ${open ? "open" : ""}`}>
        <Brand />
        <Button
          className="sidebar-close"
          variant="ghost"
          size="icon"
          aria-label={t("common.closeMenu")}
          onClick={() => setOpen(false)}
        >
          <X />
        </Button>
        <p className="nav-label">{t("nav.yourWorkspace")}</p>
        <nav aria-label={t("nav.mainNavigation")}>
          {links.map(([path, label, Icon]) => (
            <NavLink
              end={path === "/app"}
              key={path}
              to={path}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `nav-item ${isActive ? "active" : ""}`
              }
            >
              <Icon size={18} />
              {t(`nav.${label}`)}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="account">
            <span className="avatar">
              {user?.username.slice(0, 2).toUpperCase()}
            </span>
            <div>
              <strong>{user?.username}</strong>
              <small>{user?.email}</small>
            </div>
          </div>
          <Button
            variant="ghost"
            onClick={() => {
              logout();
              navigate("/login");
            }}
          >
            <LogOut size={16} />
            {t("nav.logout")}
          </Button>
        </div>
      </aside>
      <div className="app-main">
        <header className="topbar">
          <Button
            className="mobile-menu-button"
            variant="ghost"
            size="icon"
            aria-label={t("common.openMenu")}
            onClick={() => setOpen(true)}
          >
            <Menu />
          </Button>
          <span className="header-breadcrumb">
            {t("common.workspace")} <span>/</span> {t("nav.workspaceOverview")}
          </span>
          <Preferences />
        </header>
        <main id="main" className="page-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
