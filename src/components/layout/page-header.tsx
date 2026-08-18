import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type BreadcrumbItem = {
  label: string;
  href?: string;
};

type PageHeaderProps = {
  title: string;
  description?: string;
  breadcrumbs?: BreadcrumbItem[];
  actions?: React.ReactNode;
  /** Shown below title on mobile; merged into actions row on desktop */
  mobileActions?: React.ReactNode;
};

export function PageHeader({
  title,
  description,
  breadcrumbs,
  actions,
  mobileActions,
}: PageHeaderProps) {
  return (
    <div className="mb-6 flex flex-col gap-4 border-b border-border pb-5 sm:mb-8 sm:pb-6">
      <div className="space-y-3">
        {breadcrumbs && breadcrumbs.length > 0 ? (
          <nav aria-label="Breadcrumb">
            <ol className="flex flex-wrap items-center gap-1 text-sm text-foreground-subtle">
              {breadcrumbs.map((item, index) => {
                const isLast = index === breadcrumbs.length - 1;
                return (
                  <li key={`${item.label}-${index}`} className="flex items-center gap-1">
                    {item.href && !isLast ? (
                      <Link
                        href={item.href}
                        className="rounded-sm hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {item.label}
                      </Link>
                    ) : (
                      <span
                        className={cn(isLast && "font-medium text-foreground-muted")}
                        aria-current={isLast ? "page" : undefined}
                      >
                        {item.label}
                      </span>
                    )}
                    {!isLast ? <ChevronRight className="h-4 w-4" aria-hidden="true" /> : null}
                  </li>
                );
              })}
            </ol>
          </nav>
        ) : null}
        <div>
          <h1 className="text-page-title">{title}</h1>
          {description ? (
            <p className="mt-2 max-w-3xl text-sm text-foreground-muted">{description}</p>
          ) : null}
        </div>
      </div>
      {mobileActions ? (
        <div className="flex flex-wrap items-center gap-2 lg:hidden">{mobileActions}</div>
      ) : null}
      {actions ? (
        <div className="flex flex-wrap items-center gap-2 lg:ml-auto lg:justify-end">
          {actions}
        </div>
      ) : null}
    </div>
  );
}
