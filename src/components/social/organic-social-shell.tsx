"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { label: "Overview", href: "/social", match: (path: string) => path === "/social" },
  {
    label: "Content",
    href: "/content/studio",
    match: (path: string) => path.startsWith("/content"),
  },
  {
    label: "Reels & Shorts",
    href: "/social/reels",
    match: (path: string) => path.startsWith("/social/reels"),
  },
  {
    label: "Publishing",
    href: "/publishing",
    match: (path: string) => path.startsWith("/publishing"),
  },
  {
    label: "Calendar",
    href: "/calendar",
    match: (path: string) => path.startsWith("/calendar"),
  },
  {
    label: "Channels",
    href: "/social/connections",
    match: (path: string) => path.startsWith("/social/connections"),
  },
  {
    label: "Performance",
    href: "/social/performance",
    match: (path: string) => path.startsWith("/social/performance"),
  },
] as const;

export function OrganicSocialShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const showTabs = TABS.some((tab) => tab.match(pathname));

  if (!showTabs) {
    return <>{children}</>;
  }

  return (
    <div className="space-y-6">
      <nav aria-label="Organic social workspace" className="border-b border-border">
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
                      ? "border-organic-accent text-foreground"
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
