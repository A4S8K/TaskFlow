import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragEndEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Plus, CalendarDays } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  useMutation,
  useQueryClient,
  type QueryKey,
} from "@tanstack/react-query";
import { toast } from "sonner";
import { tasksApi } from "../../api/resources";
import { useAuth } from "../../contexts/AuthContext";
import {
  statuses,
  type Task,
  type Project,
  type Status,
  type Page,
} from "../../types";
import { formatDate } from "../../utils/dates";
import { Button } from "../ui/button";

export function Board({
  tasks,
  project,
  open,
  create,
  queryKey,
}: {
  tasks: Task[];
  project: Project;
  open: (task: Task) => void;
  create: () => void;
  queryKey: QueryKey;
}) {
  const { t } = useTranslation();
  const cache = useQueryClient();
  const { user } = useAuth();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor),
  );
  const allowed = (task: Task) =>
    project.role !== "MEMBER" ||
    task.creator_id === user?.id ||
    task.assigned_to_id === user?.id;
  const mutation = useMutation({
    mutationFn: ({ task, status }: { task: Task; status: Status }) =>
      tasksApi.save(project.id, { status }, task.id),
    onMutate: async ({ task, status }) => {
      await cache.cancelQueries({ queryKey });
      const previous = cache.getQueryData<Page<Task>>(queryKey);
      cache.setQueryData<Page<Task>>(
        queryKey,
        (old) =>
          old && {
            ...old,
            items: old.items.map((item) =>
              item.id === task.id ? { ...item, status } : item,
            ),
          },
      );
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) cache.setQueryData(queryKey, context.previous);
      toast.error(t("tasks.statusChangeFailed"));
    },
    onSuccess: () => toast.success(t("notifications.taskUpdated")),
    onSettled: () => cache.invalidateQueries(),
  });
  function move(task: Task, status: Status) {
    if (!mutation.isPending && allowed(task) && task.status !== status)
      mutation.mutate({ task, status });
  }
  function end(event: DragEndEvent) {
    const task = tasks.find((item) => item.id === event.active.id);
    if (task && statuses.includes(event.over?.id as Status))
      move(task, event.over!.id as Status);
  }
  return (
    <>
      <p className="board-hint">{t("tasks.dragHint")}</p>
      <DndContext sensors={sensors} onDragEnd={end}>
        <div className="board-grid">
          {statuses.map((status) => (
            <Column
              key={status}
              status={status}
              count={tasks.filter((task) => task.status === status).length}
              create={create}
            >
              {tasks
                .filter((task) => task.status === status)
                .map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    open={() => open(task)}
                    enabled={allowed(task) && !mutation.isPending}
                    move={(status) => move(task, status)}
                  />
                ))}
            </Column>
          ))}
        </div>
      </DndContext>
    </>
  );
}
function Column({
  status,
  count,
  children,
  create,
}: {
  status: Status;
  count: number;
  children: React.ReactNode;
  create: () => void;
}) {
  const { t } = useTranslation();
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <section
      ref={setNodeRef}
      className={`board-column ${isOver ? "drag-over" : ""}`}
    >
      <header className="column-header">
        <span className={`status-dot ${status}`} />
        <h2>{t(`status.${status}`)}</h2>
        <span className="column-count">{count}</span>
        <Button
          variant="ghost"
          size="icon"
          onClick={create}
          aria-label={t("tasks.addTask")}
        >
          <Plus size={16} />
        </Button>
      </header>
      <div className="column-tasks">{children}</div>
      <Button variant="ghost" className="add-task" onClick={create}>
        <Plus size={16} />
        {t("tasks.addTask")}
      </Button>
    </section>
  );
}
function TaskCard({
  task,
  open,
  enabled,
  move,
}: {
  task: Task;
  open: () => void;
  enabled: boolean;
  move: (status: Status) => void;
}) {
  const { t, i18n } = useTranslation();
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: task.id, disabled: !enabled });
  return (
    <article
      ref={setNodeRef}
      style={{
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0.45 : 1,
      }}
      className="task-card"
    >
      <div className="task-card-top">
        <span className={`priority-badge ${task.priority}`}>
          {t(`priority.${task.priority}`)}
        </span>
        {enabled && (
          <button
            className="drag-handle"
            {...attributes}
            {...listeners}
            aria-label={t("tasks.dragLabel", { title: task.title })}
          >
            <GripVertical size={16} />
          </button>
        )}
      </div>
      <button className="task-open" onClick={open}>
        <h3>{task.title}</h3>
        <p>{task.description || t("common.noDescription")}</p>
      </button>
      <div className="task-card-bottom">
        <span>
          <CalendarDays size={13} />
          {task.due_date
            ? formatDate(task.due_date, i18n.language)
            : t("common.noDueDate")}
        </span>
        <span
          className="avatar"
          title={task.assignee_username ?? t("common.unassigned")}
        >
          {task.assignee_username?.slice(0, 2).toUpperCase() ?? "—"}
        </span>
      </div>
      <select
        aria-label={t("tasks.moveTo", { status: t(`status.${task.status}`) })}
        value={task.status}
        disabled={!enabled}
        onChange={(e) => move(e.target.value as Status)}
      >
        {statuses.map((s) => (
          <option key={s} value={s}>
            {t(`status.${s}`)}
          </option>
        ))}
      </select>
    </article>
  );
}
