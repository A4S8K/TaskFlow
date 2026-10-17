import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { allMembers, projectsApi, tasksApi } from "../../api/resources";
import { useAuth } from "../../contexts/AuthContext";
import { statuses, priorities, type Task } from "../../types";
import {
  localDateTimeToUtc,
  toLocalDateTimeInput,
  formatDate,
} from "../../utils/dates";
import { getErrorMessage } from "../../utils/errors";
import { Dialog } from "../ui/dialog";
import { ConfirmDialog } from "../ui/confirm-dialog";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { Button } from "../ui/button";
import { Loading, Failure } from "../ui/feedback";

export function TaskDialog({
  projectId,
  task,
  close,
}: {
  projectId: number;
  task?: Task;
  close: () => void;
}) {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const cache = useQueryClient();
  const [remove, setRemove] = useState(false);
  const project = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => projectsApi.get(projectId),
  });
  const members = useQuery({
    queryKey: ["members", projectId],
    queryFn: () => allMembers(projectId),
  });
  const canEdit =
    !task ||
    project.data?.role === "OWNER" ||
    project.data?.role === "ADMIN" ||
    task.creator_id === user?.id;
  const canStatus = canEdit || task?.assigned_to_id === user?.id;
  const schema = z.object({
    title: z
      .string()
      .trim()
      .min(1, t("validation.titleRequired"))
      .max(200, t("validation.maxLength", { max: 200 })),
    description: z
      .string()
      .max(20000, t("validation.maxLength", { max: 20000 })),
    status: z.enum(statuses as ["TODO", "IN_PROGRESS", "DONE"]),
    priority: z.enum(priorities as ["LOW", "MEDIUM", "HIGH", "URGENT"]),
    assigned_to_id: z.string(),
    due_date: z.string(),
  });
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      title: task?.title ?? "",
      description: task?.description ?? "",
      status: task?.status ?? "TODO",
      priority: task?.priority ?? "MEDIUM",
      assigned_to_id: task?.assigned_to_id?.toString() ?? "",
      due_date: toLocalDateTimeInput(task?.due_date ?? null),
    },
  });
  const saved = async () => {
    await cache.invalidateQueries();
    toast.success(t("notifications.changesSaved"));
    close();
  };
  const mutation = useMutation({
    mutationFn: (body: z.infer<typeof schema>) =>
      tasksApi.save(
        projectId,
        canEdit
          ? {
              ...body,
              assigned_to_id: body.assigned_to_id
                ? Number(body.assigned_to_id)
                : null,
              due_date: localDateTimeToUtc(body.due_date),
            }
          : { status: body.status },
        task?.id,
      ),
    onSuccess: saved,
    onError: (e) => toast.error(getErrorMessage(e)),
  });
  const deletion = useMutation({
    mutationFn: () => tasksApi.remove(projectId, task!.id),
    onSuccess: saved,
    onError: (e) => toast.error(getErrorMessage(e)),
  });
  return (
    <>
      <Dialog
        open
        onOpenChange={(v) => {
          if (!v && !mutation.isPending && !deletion.isPending) close();
        }}
        title={t(task ? "tasks.details" : "tasks.createTitle")}
      >
        {project.isPending || members.isPending ? (
          <Loading />
        ) : project.isError || members.isError ? (
          <Failure
            error={project.error || members.error}
            retry={() => {
              void project.refetch();
              void members.refetch();
            }}
          />
        ) : (
          <form
            className="data-form"
            onSubmit={handleSubmit((body) => mutation.mutate(body))}
          >
            <label>
              {t("tasks.project")}
              <Input readOnly value={project.data.name} />
            </label>
            <label>
              {t("tasks.titleLabel")}
              <Input
                {...register("title")}
                disabled={!canEdit}
                maxLength={200}
                aria-invalid={!!errors.title}
              />
            </label>
            {errors.title && (
              <p className="field-error">{errors.title.message}</p>
            )}
            <label>
              {t("tasks.description")}
              <Textarea
                {...register("description")}
                disabled={!canEdit}
                maxLength={20000}
              />
            </label>
            <div className="form-grid">
              <label>
                {t("tasks.status")}
                <select {...register("status")} disabled={!canStatus}>
                  {statuses.map((s) => (
                    <option key={s} value={s}>
                      {t(`status.${s}`)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {t("tasks.priority")}
                <select {...register("priority")} disabled={!canEdit}>
                  {priorities.map((p) => (
                    <option key={p} value={p}>
                      {t(`priority.${p}`)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {t("tasks.assignee")}
                <select {...register("assigned_to_id")} disabled={!canEdit}>
                  <option value="">{t("common.unassigned")}</option>
                  {members.data.map((m) => (
                    <option key={m.user_id} value={m.user_id}>
                      {m.username}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {t("tasks.dueDate")}
                <Input
                  type="datetime-local"
                  {...register("due_date")}
                  disabled={!canEdit}
                />
              </label>
            </div>
            <small>{t("tasks.dueDateHint")}</small>
            {task && (
              <div className="task-meta">
                <p>
                  {t("tasks.createdAt")}:{" "}
                  {formatDate(task.created_at, i18n.language, true)}
                </p>
                <p>
                  {t("tasks.updatedAt")}:{" "}
                  {formatDate(task.updated_at, i18n.language, true)}
                </p>
              </div>
            )}
            <div className="form-actions">
              {task && canEdit && (
                <Button variant="destructive" onClick={() => setRemove(true)}>
                  {t("tasks.delete")}
                </Button>
              )}
              {canStatus ? (
                <Button type="submit" loading={mutation.isPending}>
                  {t(task ? "common.save" : "common.create")}
                </Button>
              ) : (
                <p>{t("tasks.readOnlyHint")}</p>
              )}
            </div>
          </form>
        )}
      </Dialog>
      <ConfirmDialog
        open={remove}
        onOpenChange={setRemove}
        title={t("tasks.deleteTitle")}
        description={t("tasks.deleteDescription", { title: task?.title })}
        pending={deletion.isPending}
        onConfirm={() => deletion.mutate()}
      />
    </>
  );
}
