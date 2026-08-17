"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { label: "Overview", href: "/analytics", match: (path: string) => path === "/analytics" },
  {
    label: "Channels",
    href: "/analytics/channels",
    match: (path: string) => path === "/analytics/channels",
  },
  {
    label: "Content",
    href: "/analytics/content",
    match: (path: string) => path === "/analytics/content",
  },
  {
    label: "Attribution",
    href: "/analytics/attribution",
    match: (path: string) => path === "/analytics/attribution",
  },
  {
    label: "Funnels",
    href: "/analytics/funnels",
    match: (path: string) => path === "/analytics/funnels",
  },
  {
    label: "Conversions",
    href: "/analytics/conversions",
    match: (path: string) => path === "/analytics/conversions",
  },
  {
    label: "Revenue",
    href: "/analytics/revenue",
    match: (path: string) => path === "/analytics/revenue",
  },
] as const;

export function UnifiedAnalyticsShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const showTabs = TABS.some((tab) => tab.match(pathname));

  if (!showTabs) {
    return <>{children}</>;
  }

  return (
    <div className="space-y-6">
      <nav aria-label="Unified analytics workspace" className="border-b border-border">
        <ul className="-mb-px flex flex-wrap gap-1">
          {TABS.map((tab) => {
            const active = tab.match(pathname);
            return (
              <li key={tab.href}>
                <Link
                  href={tab.href}
                  className={cn(
                    "inline-flex items-center border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
                    active
                      ? "border-foreground text-foreground"
                      : "border-transparent text-foreground-muted hover:border-border-strong hover:text-foreground",
                  )}
                  aria-current={active ? "page" : undefined}
                >
                  {tab.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      {children}
    </div>
  );
}
