import { cn } from "@/lib/utils";

export type SimpleButtonProps =
  React.ButtonHTMLAttributes<HTMLButtonElement>;

export function SimpleButton({
  children,
  className,
  type = "button",
  ...props
}: SimpleButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "rounded-md bg-blue-600 px-4 py-2 font-medium text-white transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
