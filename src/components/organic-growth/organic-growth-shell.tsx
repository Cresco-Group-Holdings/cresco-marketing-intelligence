"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { label: "Overview", href: "/organic-social", match: (path: string) => path === "/organic-social" },
  {
    label: "Accounts",
    href: "/organic-social/accounts",
    match: (path: string) => path.startsWith("/organic-social/accounts"),
  },
  {
    label: "Content",
    href: "/organic-social/content",
    match: (path: string) => path.startsWith("/organic-social/content"),
  },
  {
    label: "Publishing",
    href: "/organic-social/publishing",
    match: (path: string) => path.startsWith("/organic-social/publishing"),
  },
  {
    label: "Growth",
    href: "/organic-social/growth",
    match: (path: string) => path.startsWith("/organic-social/growth"),
  },
  {
    label: "Community",
    href: "/organic-social/community",
    match: (path: string) => path.startsWith("/organic-social/community"),
  },
  {
    label: "Intelligence",
    href: "/organic-social/intelligence",
    match: (path: string) => path.startsWith("/organic-social/intelligence"),
  },
] as const;

export function OrganicGrowthShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="space-y-6">
      <nav aria-label="Organic social workspace" className="border-b border-border -mx-1 px-1">
        <ul className="-mb-px flex gap-0.5 overflow-x-auto scrollbar-none sm:gap-1">
          {TABS.map((tab) => {
            const active = tab.match(pathname);
            return (
              <li key={tab.href}>
                <Link
                  href={tab.href}
                  className={cn(
                    "inline-flex items-center whitespace-nowrap border-b-2 px-2.5 py-2 text-xs font-medium transition-colors sm:px-3 sm:py-2.5 sm:text-sm",
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
