import { lazy, Suspense } from "react";
import { Loading } from "./components/ui/feedback";
import { Navigate, Outlet, Route, Routes, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "./contexts/AuthContext";
import { Shell } from "./components/layout/Shell";
import { Landing } from "./pages/Landing";
import { AuthPage } from "./pages/Auth";
const Dashboard = lazy(() =>
  import("./pages/Dashboard").then((module) => ({ default: module.Dashboard })),
);
const Projects = lazy(() =>
  import("./pages/Projects").then((module) => ({ default: module.Projects })),
);
const ProjectDetails = lazy(() =>
  import("./pages/ProjectDetails").then((module) => ({
    default: module.ProjectDetails,
  })),
);
const MyTasks = lazy(() =>
  import("./pages/MyTasks").then((module) => ({ default: module.MyTasks })),
);
const SettingsPage = lazy(() =>
  import("./pages/Settings").then((module) => ({
    default: module.SettingsPage,
  })),
);

function Protected() {
  return useAuth().user ? <Outlet /> : <Navigate to="/login" replace />;
}
function NotFound() {
  const { t } = useTranslation();
  return (
    <div className="empty-state">
      <h1>{t("errors.notFoundTitle")}</h1>
      <Link to="/">{t("common.back")}</Link>
    </div>
  );
}
export default function App() {
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<AuthPage />} />
        <Route path="/register" element={<AuthPage register />} />
        <Route element={<Protected />}>
          <Route path="/app" element={<Shell />}>
            <Route index element={<Dashboard />} />
            <Route path="projects" element={<Projects />} />
            <Route path="projects/:id" element={<ProjectDetails />} />
            <Route path="tasks" element={<MyTasks />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}
