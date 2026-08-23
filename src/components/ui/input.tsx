import { forwardRef } from "react";
import { cn } from "@/lib/utils";

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  labelClassName?: string;
  hint?: string;
  error?: string;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, labelClassName, hint, error, id, className, ...props },
  ref,
) {
  const inputId = id ?? props.name;

  return (
    <div className="space-y-2">
      {label ? (
        <label
          htmlFor={inputId}
          className={cn("block text-sm font-medium text-foreground-muted", labelClassName)}
        >
          {label}
        </label>
      ) : null}
      <input
        ref={ref}
        id={inputId}
        className={cn(
          "block w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-foreground shadow-sm placeholder:text-foreground-subtle focus-visible:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          error && "border-danger focus-visible:ring-danger-muted",
          className,
        )}
        aria-invalid={Boolean(error)}
        aria-describedby={hint ? `${inputId}-hint` : undefined}
        {...props}
      />
      {hint ? (
        <p id={`${inputId}-hint`} className="text-xs text-foreground-subtle">
          {hint}
        </p>
      ) : null}
      {error ? <p className="text-xs text-danger">{error}</p> : null}
    </div>
  );
});

Input.displayName = "Input";
