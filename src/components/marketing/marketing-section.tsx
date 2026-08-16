import { cn } from "@/lib/utils";

type MarketingSectionProps = {
  title: string;
  subtitle?: string;
  accent?: "paid" | "organic" | "neutral";
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
};

export function MarketingSection({
  title,
  subtitle,
  accent = "neutral",
  actions,
  children,
  className,
}: MarketingSectionProps) {
  return (
    <section
      className={cn("rounded-2xl border border-border bg-surface p-5 sm:p-6", className)}
      aria-labelledby={`section-${title.replace(/\s+/g, "-").toLowerCase()}`}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className={cn(
                "h-2.5 w-2.5 rounded-full",
                accent === "paid" && "bg-paid-accent",
                accent === "organic" && "bg-organic-accent",
                accent === "neutral" && "bg-foreground-subtle",
              )}
            />
            <h2
              id={`section-${title.replace(/\s+/g, "-").toLowerCase()}`}
              className="text-xl font-semibold text-foreground"
            >
              {title}
            </h2>
          </div>
          {subtitle ? <p className="mt-1 text-sm text-foreground-muted">{subtitle}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
      <div className="mt-6">{children}</div>
    </section>
  );
}
