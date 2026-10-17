import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  FolderKanban,
  CheckCircle2,
  ListTodo,
  Clock3,
  Plus,
  ArrowUpRight,
} from "lucide-react";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";
import { dashboardApi } from "../api/resources";
import { useAuth } from "../contexts/AuthContext";
import { ProjectCard } from "../components/projects/ProjectCard";
import { ProjectForm } from "../components/projects/ProjectForm";
import { TaskDialog } from "../components/tasks/TaskDialog";
import { Button } from "../components/ui/button";
import { Loading, Failure, Empty } from "../components/ui/feedback";
import { formatDate } from "../utils/dates";
import type { Task } from "../types";

export function Dashboard() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const [create, setCreate] = useState(false);
  const [task, setTask] = useState<Task>();
  const result = useQuery({ queryKey: ["dashboard"], queryFn: dashboardApi });
  if (result.isPending) return <Loading />;
  if (result.isError)
    return <Failure error={result.error} retry={() => void result.refetch()} />;
  const data = result.data;
  const stats = [
    [t("dashboard.totalProjects"), data.total_projects, FolderKanban, "violet"],
    [t("dashboard.totalTasks"), data.total_tasks, ListTodo, "blue"],
    [
      t("dashboard.completedTasks"),
      data.completed_tasks,
      CheckCircle2,
      "green",
    ],
    [t("dashboard.pendingTasks"), data.pending_tasks, Clock3, "amber"],
  ] as const;
  const distribution = [
    { name: t("status.TODO"), value: data.pending_tasks },
    { name: t("status.IN_PROGRESS"), value: data.in_progress_tasks },
    { name: t("status.DONE"), value: data.completed_tasks },
  ];
  return (
    <>
      <div className="page-header">
        <div>
          <span className="eyebrow">{t("dashboard.overview")}</span>
          <h1 className="page-title">
            {t("dashboard.greeting", { name: user?.username })}{" "}
            <span className="greeting-dot">✦</span>
          </h1>
          <p className="page-subtitle">{t("dashboard.subtitle")}</p>
        </div>
        <Button onClick={() => setCreate(true)}>
          <Plus size={16} />
          {t("projects.create")}
        </Button>
      </div>
      <div className="stats-grid">
        {stats.map(([label, value, Icon, color]) => (
          <article className="stat-card" key={label}>
            <div className={`stat-icon ${color}`}>
              <Icon size={20} />
            </div>
            <div>
              <p className="stat-label">{label}</p>
              <strong className="stat-value">{value}</strong>
            </div>
          </article>
        ))}
      </div>
      <div className="dashboard-grid">
        <div className="dashboard-main">
          <section>
            <div className="section-heading">
              <h2>{t("dashboard.projectProgress")}</h2>
              <Link to="/app/projects">
                {t("common.viewAll")} <ArrowUpRight size={14} />
              </Link>
            </div>
            <div className="projects-grid">
              {data.recent_projects.map((project) => (
                <ProjectCard key={project.id} project={project} />
              ))}
            </div>
            {!data.recent_projects.length && (
              <Empty
                title={t("dashboard.noProjects")}
                description={t("dashboard.noProjectsDescription")}
              />
            )}
          </section>
          <section className="panel">
            <h2>{t("dashboard.recentTasks")}</h2>
            <TaskRows tasks={data.recent_tasks} open={setTask} />
          </section>
        </div>
        <aside className="dashboard-aside">
          <section className="panel">
            <h2>{t("dashboard.taskDistribution")}</h2>
            {data.total_tasks ? (
              <>
                <div className="chart-wrap">
                  <ResponsiveContainer width="100%" height={210}>
                    <PieChart>
                      <Pie
                        isAnimationActive={false}
                        data={distribution}
                        dataKey="value"
                        innerRadius={58}
                        outerRadius={80}
                        strokeWidth={0}
                      >
                        {distribution.map((v, i) => (
                          <Cell
                            key={v.name}
                            fill={["#a5a1be", "#8b79ee", "#40b591"][i]}
                          />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <strong>
                    {Math.round(
                      (data.completed_tasks / data.total_tasks) * 100,
                    )}
                    %<small>{t("dashboard.completionRate")}</small>
                  </strong>
                </div>
                <div className="chart-legend">
                  {distribution.map((d, i) => (
                    <div key={d.name}>
                      <span
                        style={{
                          background: ["#a5a1be", "#8b79ee", "#40b591"][i],
                        }}
                      />
                      {d.name}
                      <b>{d.value}</b>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <Empty title={t("dashboard.noTasks")} />
            )}
          </section>
          <section className="panel">
            <h2>{t("dashboard.upcomingDeadlines")}</h2>
            {data.upcoming_deadlines.length ? (
              data.upcoming_deadlines.map((item) => (
                <button
                  key={item.id}
                  className="deadline-item"
                  onClick={() => setTask(item)}
                >
                  <span className={`priority-dot ${item.priority}`} />
                  <span>
                    <strong>{item.title}</strong>
                    <small>
                      {item.project_name} ·{" "}
                      {formatDate(item.due_date!, i18n.language)}
                    </small>
                  </span>
                </button>
              ))
            ) : (
              <Empty title={t("dashboard.noDeadlines")} />
            )}
          </section>
        </aside>
      </div>
      {create && <ProjectForm close={() => setCreate(false)} />}
      {task && (
        <TaskDialog
          projectId={task.project_id}
          task={task}
          close={() => setTask(undefined)}
        />
      )}
    </>
  );
}
export function TaskRows({
  tasks,
  open,
}: {
  tasks: Task[];
  open: (task: Task) => void;
}) {
  const { t, i18n } = useTranslation();
  return tasks.length ? (
    <div className="task-list">
      {tasks.map((task) => (
        <button
          className="task-list-row"
          key={task.id}
          onClick={() => open(task)}
        >
          <span className={`task-status-icon ${task.status}`}>
            {task.status === "DONE" ? "✓" : "○"}
          </span>
          <span className="task-list-title">
            <strong>{task.title}</strong>
            <small>{task.project_name}</small>
          </span>
          <span className={`priority-badge ${task.priority}`}>
            {t(`priority.${task.priority}`)}
          </span>
          <span className="task-date">
            {task.due_date ? formatDate(task.due_date, i18n.language) : "—"}
          </span>
        </button>
      ))}
    </div>
  ) : (
    <Empty title={t("tasks.emptyTitle")} />
  );
}
