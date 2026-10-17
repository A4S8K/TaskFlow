import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { read, write } from "../../api/resources";
import type { Member, Page, Project } from "../../types";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { ConfirmDialog } from "../ui/confirm-dialog";
import { Loading, Failure, Pagination } from "../ui/feedback";
import { getErrorMessage } from "../../utils/errors";
import { formatDate } from "../../utils/dates";

export function Members({ project }: { project: Project }) {
  const { t, i18n } = useTranslation();
  const cache = useQueryClient();
  const [remove, setRemove] = useState<Member>();
  const [page, setPage] = useState(1);
  const schema = z.object({
    email: z.email(t("validation.emailInvalid")),
    role: z.enum(["MEMBER", "ADMIN"]),
  });
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { email: "", role: "MEMBER" as "MEMBER" | "ADMIN" },
  });
  const result = useQuery({
    queryKey: ["member-page", project.id, page],
    queryFn: () =>
      read<Page<Member>>(`/projects/${project.id}/members`, {
        page,
        page_size: 20,
      }),
  });
  const mutation = useMutation({
    mutationFn: ({
      method,
      id,
      body,
    }: {
      method: "post" | "patch" | "delete";
      id?: number;
      body?: unknown;
    }) =>
      write(
        method,
        `/projects/${project.id}/members${id ? `/${id}` : ""}`,
        body,
      ),
    onSuccess: async () => {
      reset();
      setRemove(undefined);
      await cache.invalidateQueries();
      toast.success(t("notifications.changesSaved"));
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });
  return (
    <section className="panel">
      <h2>{t("members.title")}</h2>
      <p className="muted">{t("members.permissionsHint")}</p>
      {project.role !== "MEMBER" && (
        <form
          className="member-form"
          onSubmit={handleSubmit((body) =>
            mutation.mutate({ method: "post", body }),
          )}
        >
          <Input
            {...register("email")}
            type="email"
            aria-label={t("common.email")}
            placeholder={t("auth.emailPlaceholder")}
          />
          <select
            {...register("role")}
            aria-label={t("members.role")}
            disabled={project.role !== "OWNER"}
          >
            <option value="MEMBER">{t("role.MEMBER")}</option>
            {project.role === "OWNER" && (
              <option value="ADMIN">{t("role.ADMIN")}</option>
            )}
          </select>
          <Button type="submit" loading={mutation.isPending}>
            {t("members.add")}
          </Button>
          {errors.email && <p role="alert">{errors.email.message}</p>}
        </form>
      )}
      {result.isPending ? (
        <Loading />
      ) : result.isError ? (
        <Failure error={result.error} retry={() => void result.refetch()} />
      ) : (
        <>
          {result.data.items.map((member) => (
            <div className="member-row" key={member.user_id}>
              <span className="avatar">
                {member.username.slice(0, 2).toUpperCase()}
              </span>
              <div className="member-info">
                <strong>{member.username}</strong>
                <small>{member.email}</small>
                <small>
                  {t("members.joinedAt")}:{" "}
                  {formatDate(member.joined_at, i18n.language)}
                </small>
              </div>
              <div className="member-actions">
                {member.role !== "OWNER" && project.role === "OWNER" ? (
                  <select
                    aria-label={`${t("members.changeRole")}: ${member.username}`}
                    value={member.role}
                    disabled={mutation.isPending}
                    onChange={(e) =>
                      mutation.mutate({
                        method: "patch",
                        id: member.user_id,
                        body: { role: e.target.value },
                      })
                    }
                  >
                    <option value="MEMBER">{t("role.MEMBER")}</option>
                    <option value="ADMIN">{t("role.ADMIN")}</option>
                  </select>
                ) : (
                  <span className="role-badge">{t(`role.${member.role}`)}</span>
                )}
                {member.role !== "OWNER" &&
                  (project.role === "OWNER" ||
                    (project.role === "ADMIN" && member.role === "MEMBER")) && (
                    <Button variant="ghost" onClick={() => setRemove(member)}>
                      {t("common.remove")}
                    </Button>
                  )}
              </div>
            </div>
          ))}
          <Pagination
            page={page}
            total={result.data.total}
            size={20}
            setPage={setPage}
          />
        </>
      )}
      <ConfirmDialog
        open={!!remove}
        onOpenChange={(v) => {
          if (!v) setRemove(undefined);
        }}
        title={t("members.removeTitle")}
        description={t("members.removeDescription", { name: remove?.username })}
        pending={mutation.isPending}
        onConfirm={() =>
          mutation.mutate({ method: "delete", id: remove!.user_id })
        }
      />
    </section>
  );
}
