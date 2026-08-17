import { cn } from "@/lib/utils";

type StatusBadgeVariant =
  | "active"
  | "paused"
  | "draft"
  | "scheduled"
  | "published"
  | "failed"
  | "connected"
  | "delayed"
  | "stale"
  | "disconnected"
  | "neutral";

const variantClasses: Record<StatusBadgeVariant, string> = {
  active: "bg-success-muted text-success",
  paused: "bg-warning-muted text-warning",
  draft: "bg-surface-hover text-foreground-muted",
  scheduled: "bg-paid-accent-soft text-paid-accent",
  published: "bg-organic-accent-soft text-organic-accent",
  failed: "bg-danger-muted text-danger",
  connected: "bg-success-muted text-success",
  delayed: "bg-warning-muted text-warning",
  stale: "bg-warning-muted text-warning",
  disconnected: "bg-danger-muted text-danger",
  neutral: "bg-surface-hover text-foreground-muted",
};

type StatusBadgeProps = React.HTMLAttributes<HTMLSpanElement> & {
  variant?: StatusBadgeVariant;
  dot?: boolean;
};

export function StatusBadge({
  className,
  variant = "neutral",
  dot = true,
  children,
  ...props
}: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
        variantClasses[variant],
        className,
      )}
      {...props}
    >
      {dot ? (
        <span
          className="h-1.5 w-1.5 shrink-0 rounded-full bg-current"
          aria-hidden="true"
        />
      ) : null}
      {children}
    </span>
  );
}
