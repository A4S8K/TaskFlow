import { useTranslation } from "react-i18next";
import { Button } from "./button";
import { Skeleton } from "./skeleton";
import { getErrorMessage } from "../../utils/errors";

export function Loading() {
  const { t } = useTranslation();
  return (
    <div
      role="status"
      aria-label={t("common.loading")}
      className="loading-state"
    >
      <Skeleton className="skeleton-heading" />
      <div className="stats-grid">
        {[1, 2, 3, 4].map((n) => (
          <Skeleton key={n} className="skeleton-panel" />
        ))}
      </div>
    </div>
  );
}
export function Failure({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div role="alert" className="error-state">
      <h3>{t("errors.title")}</h3>
      <p>{getErrorMessage(error)}</p>
      <Button onClick={retry}>{t("common.retry")}</Button>
    </div>
  );
}
export function Empty({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="empty-state">
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}
export function Pagination({
  page,
  total,
  size,
  setPage,
}: {
  page: number;
  total: number;
  size: number;
  setPage: (value: number) => void;
}) {
  const { t } = useTranslation();
  const pages = Math.max(1, Math.ceil(total / size));
  return (
    <div className="pagination">
      <span>{t("common.page", { page, total: pages })}</span>
      <div className="pagination-actions">
        <Button
          variant="outline"
          disabled={page <= 1}
          onClick={() => setPage(page - 1)}
        >
          {t("common.previous")}
        </Button>
        <Button
          variant="outline"
          disabled={page >= pages}
          onClick={() => setPage(page + 1)}
        >
          {t("common.next")}
        </Button>
      </div>
    </div>
  );
}
