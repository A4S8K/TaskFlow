import { forwardRef, type SelectHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "../../utils/cn";

export const Select = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement>
>(({ className, children, ...props }, ref) => (
  <span className="ui-select-wrap">
    <select
      ref={ref}
      className={cn("ui-input ui-select", className)}
      {...props}
    >
      {children}
    </select>
    <ChevronDown className="ui-select-chevron" size={15} aria-hidden="true" />
  </span>
));
Select.displayName = "Select";
