import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { tasksApi } from "../api/resources";
import {
  TaskFilters,
  defaultFilters,
  filterParams,
} from "../components/tasks/TaskFilters";
import { TaskDialog } from "../components/tasks/TaskDialog";
import { Loading, Failure, Pagination } from "../components/ui/feedback";
import { TaskRows } from "./Dashboard";
import type { Task } from "../types";

export function MyTasks() {
  const { t } = useTranslation();
  const [filters, setFilters] = useState(defaultFilters);
  const [page, setPage] = useState(1);
  const [task, setTask] = useState<Task>();
  const result = useQuery({
    queryKey: ["my-tasks", filters, page],
    queryFn: ({ signal }) =>
      tasksApi.list(undefined, { ...filterParams(filters), page }, signal),
  });
  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">{t("tasks.myTasksTitle")}</h1>
          <p className="page-subtitle">{t("tasks.myTasksSubtitle")}</p>
        </div>
      </div>
      <TaskFilters
        value={filters}
        change={(value) => {
          setFilters(value);
          setPage(1);
        }}
      />
      {result.isPending ? (
        <Loading />
      ) : result.isError ? (
        <Failure error={result.error} retry={() => void result.refetch()} />
      ) : (
        <section className="panel">
          <TaskRows tasks={result.data.items} open={setTask} />
          <Pagination
            page={page}
            total={result.data.total}
            size={30}
            setPage={setPage}
          />
        </section>
      )}
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
