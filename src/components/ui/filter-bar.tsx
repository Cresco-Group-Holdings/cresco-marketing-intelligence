import { cn } from "@/lib/utils";

type FilterBarProps = {
  children: React.ReactNode;
  className?: string;
};

export function FilterBar({ children, className }: FilterBarProps) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface-subtle p-3",
        className,
      )}
    >
      {children}
    </div>
  );
}

type FilterInputProps = React.InputHTMLAttributes<HTMLInputElement>;

export function FilterInput({ className, ...props }: FilterInputProps) {
  return (
    <input
      className={cn(
        "h-9 min-w-[10rem] rounded-lg border border-border bg-surface-elevated px-3 text-sm text-foreground placeholder:text-foreground-subtle focus-visible:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
      {...props}
    />
  );
}

type FilterSelectProps = React.SelectHTMLAttributes<HTMLSelectElement>;

export function FilterSelect({ className, children, ...props }: FilterSelectProps) {
  return (
    <select
      className={cn(
        "h-9 rounded-lg border border-border bg-surface-elevated px-3 text-sm text-foreground focus-visible:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}
