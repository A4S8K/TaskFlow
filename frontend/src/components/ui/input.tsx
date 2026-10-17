import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "../../utils/cn";

export const Input = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement>
>(({ className, type = "text", ...props }, ref) => (
  <input
    ref={ref}
    type={type}
    className={cn("ui-input", className)}
    {...props}
  />
));
Input.displayName = "Input";
