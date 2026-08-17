import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type EmptyStateProps = {
  title: string;
  description: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
};

export function EmptyState({ title, description, action, icon, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-surface-subtle px-6 py-12 text-center",
        className,
      )}
    >
      {icon ? <div className="mb-4 text-foreground-subtle">{icon}</div> : null}
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <p className="mt-2 max-w-md text-sm text-foreground-muted">{description}</p>
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}

type ErrorStateProps = {
  title: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
};

export function ErrorState({ title, description, onRetry, className }: ErrorStateProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-danger/20 bg-danger-muted/30 px-4 py-4",
        className,
      )}
      role="alert"
    >
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description ? <p className="mt-1 text-sm text-foreground-muted">{description}</p> : null}
      {onRetry ? (
        <div className="mt-3">
          <Button variant="outline" size="sm" onClick={onRetry}>
            Retry
          </Button>
        </div>
      ) : null}
    </div>
  );
}
