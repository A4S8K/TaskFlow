import type { ReactNode } from "react";
import { AlertCircle, Inbox, LoaderCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "./button";
import { Skeleton } from "./skeleton";

export function LoadingState({ label }: { label?: string }) {
  const { t } = useTranslation();
  return (
    <div className="loading-state" role="status">
      <span className="sr-only">{label ?? t("common.loading")}</span>
      <div className="loading-state-heading">
        <Skeleton className="skeleton-heading" />
        <Skeleton className="skeleton-copy" />
      </div>
      <div className="stats-grid">
        {[1, 2, 3, 4].map((item) => (
          <div className="ui-card skeleton-stat" key={item}>
            <Skeleton className="skeleton-icon" />
            <Skeleton className="skeleton-number" />
            <Skeleton className="skeleton-copy" />
          </div>
        ))}
      </div>
      <Skeleton className="skeleton-panel" />
    </div>
  );
}

export function InlineLoading({ label }: { label?: string }) {
  const { t } = useTranslation();
  return (
    <span className="inline-loading" role="status">
      <LoaderCircle size={16} className="animate-spin" aria-hidden="true" />
      {label ?? t("common.loading")}
    </span>
  );
}

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon" aria-hidden="true">
        {icon ?? <Inbox size={26} strokeWidth={1.5} />}
      </div>
      <h3>{title}</h3>
      {description ? <p>{description}</p> : null}
      {action ? <div className="empty-state-action">{action}</div> : null}
    </div>
  );
}

export function ErrorState({
  message,
  onRetry,
}: {
  error?: unknown;
  message?: string;
  onRetry?: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="error-state" role="alert">
      <span className="error-state-icon">
        <AlertCircle size={24} aria-hidden="true" />
      </span>
      <h3>{t("errors.title")}</h3>
      <p>{message ?? t("errors.generic")}</p>
      {onRetry ? (
        <Button variant="outline" onClick={onRetry}>
          {t("common.retry")}
        </Button>
      ) : null}
    </div>
  );
}
