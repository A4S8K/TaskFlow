import { useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Plus, ArrowLeft, FolderKanban } from "lucide-react";
import { toast } from "sonner";
import { projectsApi, tasksApi, allMembers } from "../api/resources";
import { ProjectForm } from "../components/projects/ProjectForm";
import { Members } from "../components/projects/Members";
import { Board } from "../components/tasks/Board";
import { TaskDialog } from "../components/tasks/TaskDialog";
import {
  TaskFilters,
  defaultFilters,
  filterParams,
} from "../components/tasks/TaskFilters";
import { Button } from "../components/ui/button";
import { ConfirmDialog } from "../components/ui/confirm-dialog";
import { Loading, Failure, Pagination } from "../components/ui/feedback";
import { getErrorMessage } from "../utils/errors";
import { formatDate } from "../utils/dates";
import type { Task } from "../types";

export function ProjectDetails() {
  const id = Number(useParams().id);
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const cache = useQueryClient();
  const [tab, setTab] = useState("board");
  const [edit, setEdit] = useState(false);
  const [remove, setRemove] = useState(false);
  const [task, setTask] = useState<Task | "new">();
  const [filters, setFilters] = useState(defaultFilters);
  const [page, setPage] = useState(1);
  const project = useQuery({
    queryKey: ["project", id],
    queryFn: () => projectsApi.get(id),
  });
  const queryKey = ["tasks", id, filters, page];
  const tasks = useQuery({
    queryKey,
    queryFn: ({ signal }) =>
      tasksApi.list(id, { ...filterParams(filters), page }, signal),
  });
  const members = useQuery({
    queryKey: ["members", id],
    queryFn: () => allMembers(id),
  });
  const deletion = useMutation({
    mutationFn: () => projectsApi.remove(id),
    onSuccess: async () => {
      await cache.invalidateQueries();
      toast.success(t("notifications.projectDeleted"));
      navigate("/app/projects");
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });
  if (project.isPending) return <Loading />;
  if (project.isError)
    return (
      <Failure error={project.error} retry={() => void project.refetch()} />
    );
  const data = project.data;
  return (
    <>
      <Link className="back-link" to="/app/projects">
        <ArrowLeft size={15} />
        {t("projects.backToProjects")}
      </Link>
      <div className="page-header">
        <div className="project-heading">
          <span className="project-icon">
            <FolderKanban />
          </span>
          <div>
            <h1 className="page-title">{data.name}</h1>
            <p className="page-subtitle">
              {data.description || t("common.noDescription")}
            </p>
          </div>
        </div>
        <Button onClick={() => setTask("new")}>
          <Plus size={16} />
          {t("tasks.create")}
        </Button>
      </div>
      <div className="project-tabs" role="tablist">
        {[
          "board",
          "members",
          "overview",
          ...(data.role !== "MEMBER" ? ["settings"] : []),
        ].map((key) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={tab === key ? "active" : ""}
          >
            {t(`projects.${key}`)}
          </button>
        ))}
      </div>
      {tab === "board" && (
        <>
          <TaskFilters
            value={filters}
            members={members.data}
            change={(value) => {
              setFilters(value);
              setPage(1);
            }}
          />
          {tasks.isPending ? (
            <Loading />
          ) : tasks.isError ? (
            <Failure error={tasks.error} retry={() => void tasks.refetch()} />
          ) : (
            <>
              <Board
                tasks={tasks.data.items}
                project={data}
                queryKey={queryKey}
                open={setTask}
                create={() => setTask("new")}
              />
              <Pagination
                page={page}
                total={tasks.data.total}
                size={30}
                setPage={setPage}
              />
            </>
          )}
        </>
      )}
      {tab === "members" && <Members project={data} />}
      {tab === "overview" && (
        <section className="panel project-overview">
          <h2>{t("projects.overview")}</h2>
          <p>{data.description || t("common.noDescription")}</p>
          <dl>
            <dt>{t("projects.progress")}</dt>
            <dd>{data.completion_percentage}%</dd>
            <dt>{t("tasks.title")}</dt>
            <dd>
              {data.completed_tasks}/{data.task_count}
            </dd>
            <dt>{t("members.title")}</dt>
            <dd>{data.member_count}</dd>
            <dt>{t("common.createdAt")}</dt>
            <dd>{formatDate(data.created_at, i18n.language, true)}</dd>
            <dt>{t("common.updatedAt")}</dt>
            <dd>{formatDate(data.updated_at, i18n.language, true)}</dd>
          </dl>
        </section>
      )}
      {tab === "settings" && (
        <section className="panel data-form">
          <h2>{t("projects.settings")}</h2>
          <Button variant="outline" onClick={() => setEdit(true)}>
            {t("projects.edit")}
          </Button>
          {data.role === "OWNER" && (
            <Button variant="destructive" onClick={() => setRemove(true)}>
              {t("projects.delete")}
            </Button>
          )}
        </section>
      )}
      {edit && <ProjectForm project={data} close={() => setEdit(false)} />}
      {task && (
        <TaskDialog
          key={task === "new" ? "new" : task.id}
          projectId={id}
          task={task === "new" ? undefined : task}
          close={() => setTask(undefined)}
        />
      )}
      <ConfirmDialog
        open={remove}
        onOpenChange={setRemove}
        title={t("projects.deleteTitle")}
        description={t("projects.deleteDescription", { name: data.name })}
        pending={deletion.isPending}
        onConfirm={() => deletion.mutate()}
      />
    </>
  );
}
