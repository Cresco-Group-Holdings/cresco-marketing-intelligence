"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { label: "Overview", href: "/advertising", match: (path: string) => path === "/advertising" },
  {
    label: "Campaigns",
    href: "/advertising/campaigns",
    match: (path: string) => path.startsWith("/advertising/campaigns"),
  },
  {
    label: "Creatives",
    href: "/advertising/creatives",
    match: (path: string) => path.startsWith("/advertising/creatives"),
  },
  {
    label: "Audiences",
    href: "/advertising/audiences",
    match: (path: string) => path.startsWith("/advertising/audiences"),
  },
  {
    label: "Budget",
    href: "/advertising/budgets",
    match: (path: string) => path.startsWith("/advertising/budgets"),
  },
  {
    label: "Experiments",
    href: "/advertising/experiments",
    match: (path: string) => path.startsWith("/advertising/experiments"),
  },
] as const;

export function PaidAdvertisingShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const showTabs = TABS.some((tab) => tab.match(pathname));

  if (!showTabs) {
    return <>{children}</>;
  }

  return (
    <div className="space-y-6">
      <nav aria-label="Paid advertising workspace" className="border-b border-border">
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
                      ? "border-paid-accent text-foreground"
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
