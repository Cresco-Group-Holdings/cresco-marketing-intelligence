import { cn } from "@/lib/utils";

type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & {
  variant?: "default" | "muted" | "warning" | "success" | "danger" | "paid" | "organic";
};

const variants: Record<NonNullable<BadgeProps["variant"]>, string> = {
  default: "bg-primary text-primary-foreground",
  muted: "bg-surface-hover text-foreground-muted",
  warning: "bg-warning-muted text-warning",
  success: "bg-success-muted text-success",
  danger: "bg-danger-muted text-danger",
  paid: "bg-paid-accent-muted text-paid-accent",
  organic: "bg-organic-accent-muted text-organic-accent",
};

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}
