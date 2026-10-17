import { useForm } from "react-hook-form";
import { z } from "../../utils/validation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { projectsApi } from "../../api/resources";
import type { Project } from "../../types";
import { Dialog } from "../ui/dialog";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { Button } from "../ui/button";
import { getErrorMessage } from "../../utils/errors";

export function ProjectForm({
  project,
  close,
}: {
  project?: Project;
  close: () => void;
}) {
  const { t } = useTranslation();
  const cache = useQueryClient();
  const schema = z.object({
    name: z
      .string()
      .trim()
      .min(1, t("validation.nameRequired"))
      .max(150, t("validation.maxLength", { max: 150 })),
    description: z
      .string()
      .max(10000, t("validation.maxLength", { max: 10000 })),
  });
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      name: project?.name ?? "",
      description: project?.description ?? "",
    },
  });
  const mutation = useMutation({
    mutationFn: (body: z.infer<typeof schema>) =>
      projectsApi.save(body, project?.id),
    onSuccess: async () => {
      await cache.invalidateQueries();
      toast.success(
        t(
          project
            ? "notifications.projectUpdated"
            : "notifications.projectCreated",
        ),
      );
      close();
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });
  return (
    <Dialog
      open
      onOpenChange={(v) => {
        if (!v && !mutation.isPending) close();
      }}
      title={t(project ? "projects.edit" : "projects.createTitle")}
    >
      <form
        className="data-form"
        onSubmit={handleSubmit((body) => mutation.mutate(body))}
      >
        <label>
          {t("projects.name")}
          <Input
            {...register("name")}
            maxLength={150}
            autoFocus
            aria-invalid={!!errors.name}
          />
        </label>
        {errors.name && <p className="field-error">{errors.name.message}</p>}
        <label>
          {t("projects.description")}
          <Textarea {...register("description")} maxLength={10000} />
        </label>
        <Button type="submit" loading={mutation.isPending}>
          {t(project ? "common.save" : "common.create")}
        </Button>
      </form>
    </Dialog>
  );
}
