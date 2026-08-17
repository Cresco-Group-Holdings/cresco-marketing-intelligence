"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import {
  dashboardNavigationSections,
  type NavigationItem,
} from "@/components/navigation/dashboard-nav";
import { Badge } from "@/components/ui/badge";
import { APP_NAME } from "@/lib/constants";
import { cn } from "@/lib/utils";

function isNavItemActive(pathname: string, href: string): boolean {
  if (pathname === href) {
    return true;
  }

  if (href === "/dashboard") {
    return false;
  }

  if (href === "/knowledge" && pathname.includes("/knowledge")) {
    return true;
  }

  if (href === "/assets" && pathname.includes("/assets")) {
    return true;
  }

  if (href === "/advertising" && pathname.startsWith("/advertising")) {
    return true;
  }

  if (href === "/social" && pathname.startsWith("/social")) {
    return true;
  }

  if (href === "/content" && pathname.startsWith("/content")) {
    return true;
  }

  if (href === "/analytics" && pathname.startsWith("/analytics")) {
    return true;
  }

  if (href === "/growth" && pathname.startsWith("/growth")) {
    return true;
  }

  return pathname.startsWith(`${href}/`);
}

function NavLink({
  item,
  pathname,
  onNavigate,
}: {
  item: NavigationItem;
  pathname: string;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  const isActive = isNavItemActive(pathname, item.href);

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={cn(
        "relative flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        isActive
          ? "bg-surface-selected text-foreground before:absolute before:left-0 before:top-1/2 before:h-5 before:w-0.5 before:-translate-y-1/2 before:rounded-full before:bg-paid-accent"
          : "text-foreground-muted hover:bg-surface-hover hover:text-foreground",
      )}
      aria-current={isActive ? "page" : undefined}
      title={item.description}
    >
      <span className="flex min-w-0 items-center gap-3">
        <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="truncate">{item.label}</span>
      </span>
      {item.comingSoon ? (
        <Badge variant="warning" className="shrink-0 text-[10px]">
          Soon
        </Badge>
      ) : null}
    </Link>
  );
}

function SidebarContent({
  pathname,
  onNavigate,
}: {
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
      {dashboardNavigationSections.map((section) => (
        <div key={section.id}>
          <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-foreground-subtle">
            {section.label}
          </p>
          <nav aria-label={`${section.label} navigation`} className="mt-1 flex flex-col gap-1">
            {section.items.map((item) => (
              <NavLink
                key={item.href}
                item={item}
                pathname={pathname}
                onNavigate={onNavigate}
              />
            ))}
          </nav>
        </div>
      ))}
    </div>
  );
}

export function SidebarNav() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="inline-flex items-center justify-center rounded-lg border border-border bg-surface-elevated p-2 text-foreground-muted shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:hidden"
        aria-expanded={mobileOpen}
        aria-controls="mobile-sidebar"
        onClick={() => setMobileOpen((open) => !open)}
      >
        <span className="sr-only">{mobileOpen ? "Close navigation" : "Open navigation"}</span>
        {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {mobileOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden" id="mobile-sidebar">
          <button
            type="button"
            className="absolute inset-0 bg-foreground/40"
            aria-label="Close navigation overlay"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative flex h-full w-72 max-w-[85vw] flex-col bg-surface-elevated shadow-xl">
            <div className="flex items-center justify-between border-b border-border px-4 py-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-foreground-subtle">
                  Workspace
                </p>
                <p className="text-sm font-semibold text-foreground">{APP_NAME}</p>
              </div>
              <button
                type="button"
                className="rounded-lg p-2 text-foreground-muted hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => setMobileOpen(false)}
              >
                <span className="sr-only">Close navigation</span>
                <X className="h-5 w-5" />
              </button>
            </div>
            <SidebarContent pathname={pathname} onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      ) : null}
    </>
  );
}

export function DesktopSidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-64 shrink-0 border-r border-border bg-surface lg:flex lg:flex-col">
      <div className="border-b border-border px-6 py-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-foreground-subtle">
          Workspace
        </p>
        <p className="mt-1 text-sm font-semibold text-foreground">{APP_NAME}</p>
      </div>
      <SidebarContent pathname={pathname} />
    </aside>
  );
}
