import type { ReactNode } from "react";
import { cn } from "../../utils/cn";
import { Label } from "./label";

export function Field({
  label,
  htmlFor,
  children,
  error,
  description,
  className,
}: {
  label: string;
  htmlFor: string;
  children: ReactNode;
  error?: string;
  description?: string;
  className?: string;
}) {
  return (
    <div className={cn("form-field", className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error ? (
        <p id={`${htmlFor}-error`} className="field-error" role="alert">
          {error}
        </p>
      ) : description ? (
        <p id={`${htmlFor}-description`} className="field-description">
          {description}
        </p>
      ) : null}
    </div>
  );
}
