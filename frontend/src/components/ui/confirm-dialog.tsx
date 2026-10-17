import type { ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "./button";
import { Dialog } from "./dialog";

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  onConfirm: () => void;
  pending?: boolean;
  confirmLabel?: string;
  destructive?: boolean;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  onConfirm,
  pending = false,
  confirmLabel,
  destructive = true,
}: ConfirmDialogProps) {
  const { t } = useTranslation();
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!pending) onOpenChange(next);
      }}
      title={title}
      className="ui-dialog-confirm"
      footer={
        <>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            {t("common.cancel")}
          </Button>
          <Button
            variant={destructive ? "destructive" : "default"}
            onClick={onConfirm}
            loading={pending}
          >
            {confirmLabel ??
              t(destructive ? "common.delete" : "common.confirm")}
          </Button>
        </>
      }
    >
      <div className="confirm-message">
        <span className={cnConfirmIcon(destructive)}>
          <AlertTriangle size={22} aria-hidden="true" />
        </span>
        <p>{description}</p>
      </div>
    </Dialog>
  );
}

function cnConfirmIcon(destructive: boolean) {
  return `confirm-icon${destructive ? " is-destructive" : ""}`;
}
