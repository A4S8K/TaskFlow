import { useTranslation } from "react-i18next";
import { Input } from "../ui/input";
import { statuses, priorities, type Member } from "../../types";

export interface FilterValues {
  search: string;
  status: string;
  priority: string;
  assigned_to_id: string;
  due_before: string;
  sort: string;
  direction: string;
}
export const defaultFilters: FilterValues = {
  search: "",
  status: "",
  priority: "",
  assigned_to_id: "",
  due_before: "",
  sort: "updated_at",
  direction: "desc",
};
export function TaskFilters({
  value,
  change,
  members,
}: {
  value: FilterValues;
  change: (value: FilterValues) => void;
  members?: Member[];
}) {
  const { t } = useTranslation();
  function set(key: keyof FilterValues, next: string) {
    change({ ...value, [key]: next });
  }
  return (
    <div className="toolbar task-filters">
      <Input
        value={value.search}
        onChange={(e) => set("search", e.target.value)}
        placeholder={t("tasks.searchPlaceholder")}
        aria-label={t("tasks.searchPlaceholder")}
      />
      <select
        aria-label={t("tasks.status")}
        value={value.status}
        onChange={(e) => set("status", e.target.value)}
      >
        <option value="">{t("tasks.allStatuses")}</option>
        {statuses.map((s) => (
          <option key={s} value={s}>
            {t(`status.${s}`)}
          </option>
        ))}
      </select>
      <select
        aria-label={t("tasks.priority")}
        value={value.priority}
        onChange={(e) => set("priority", e.target.value)}
      >
        <option value="">{t("tasks.allPriorities")}</option>
        {priorities.map((p) => (
          <option key={p} value={p}>
            {t(`priority.${p}`)}
          </option>
        ))}
      </select>
      {members && (
        <select
          aria-label={t("tasks.assignee")}
          value={value.assigned_to_id}
          onChange={(e) => set("assigned_to_id", e.target.value)}
        >
          <option value="">{t("common.all")}</option>
          {members.map((m) => (
            <option key={m.user_id} value={m.user_id}>
              {m.username}
            </option>
          ))}
        </select>
      )}
      <label className="filter-date">
        <span>{t("tasks.dueDate")}</span>
        <Input
          type="date"
          aria-label={t("tasks.dueDate")}
          value={value.due_before}
          onChange={(e) => set("due_before", e.target.value)}
        />
      </label>
      <select
        aria-label={t("common.sort")}
        value={value.sort}
        onChange={(e) => set("sort", e.target.value)}
      >
        {["updated_at", "due_date", "title", "priority", "status"].map((s) => (
          <option key={s} value={s}>
            {t(`sort.${s}`)}
          </option>
        ))}
      </select>
      <select
        aria-label={t("common.direction")}
        value={value.direction}
        onChange={(e) => set("direction", e.target.value)}
      >
        <option value="desc">{t("sort.desc")}</option>
        <option value="asc">{t("sort.asc")}</option>
      </select>
    </div>
  );
}
export function filterParams(value: FilterValues) {
  return {
    ...value,
    search: value.search || undefined,
    status: value.status || undefined,
    priority: value.priority || undefined,
    assigned_to_id: value.assigned_to_id || undefined,
    due_before: value.due_before
      ? new Date(`${value.due_before}T23:59:59`).toISOString()
      : undefined,
  };
}
