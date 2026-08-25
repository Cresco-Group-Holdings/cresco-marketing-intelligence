"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { label: "Overview", href: "/content/studio", match: (path: string) => path === "/content/studio" },
  {
    label: "Strategy",
    href: "/content/studio/strategy",
    match: (path: string) => path.startsWith("/content/studio/strategy"),
  },
  {
    label: "Create",
    href: "/content/studio/create",
    match: (path: string) => path.startsWith("/content/studio/create"),
  },
  {
    label: "Library",
    href: "/content/studio/library",
    match: (path: string) => path.startsWith("/content/studio/library"),
  },
  {
    label: "Workflow",
    href: "/content/studio/workflow",
    match: (path: string) => path.startsWith("/content/studio/workflow"),
  },
  {
    label: "Performance",
    href: "/content/studio/performance",
    match: (path: string) => path.startsWith("/content/studio/performance"),
  },
  {
    label: "Templates",
    href: "/content/studio/templates",
    match: (path: string) => path.startsWith("/content/studio/templates"),
  },
] as const;

export function ContentIntelligenceShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="space-y-6">
      <nav aria-label="Content Studio workspace" className="border-b border-border -mx-1 px-1">
        <ul className="-mb-px flex gap-0.5 overflow-x-auto scrollbar-none sm:gap-1">
          {TABS.map((tab) => {
            const active = tab.match(pathname);
            return (
              <li key={tab.href}>
                <Link
                  href={tab.href}
                  className={cn(
                    "inline-flex items-center whitespace-nowrap border-b-2 px-2 py-2 text-xs font-medium transition-colors sm:px-3 sm:py-2.5 sm:text-sm",
                    active
                      ? "border-primary text-foreground"
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
