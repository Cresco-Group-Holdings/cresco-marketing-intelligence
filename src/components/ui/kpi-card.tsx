import { cn } from "@/lib/utils";

type KpiCardProps = {
  label: string;
  value: string;
  change?: string;
  changeDirection?: "up" | "down" | "neutral";
  context?: string;
  className?: string;
};

export function KpiCard({
  label,
  value,
  change,
  changeDirection = "neutral",
  context,
  className,
}: KpiCardProps) {
  const changeColor =
    changeDirection === "up"
      ? "text-positive"
      : changeDirection === "down"
        ? "text-negative"
        : "text-foreground-subtle";

  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-surface-elevated px-4 py-4",
        className,
      )}
    >
      <p className="text-label">{label}</p>
      <p className="mt-2 text-kpi-value">{value}</p>
      {change ? <p className={cn("mt-1 text-sm font-medium", changeColor)}>{change}</p> : null}
      {context ? <p className="mt-1 text-xs text-foreground-subtle">{context}</p> : null}
    </div>
  );
}
