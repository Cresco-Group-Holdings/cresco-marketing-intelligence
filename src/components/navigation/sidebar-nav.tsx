"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, ChevronLeft, ChevronRight, Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import {
  dashboardNavigationSections,
  type NavigationItem,
} from "@/components/navigation/dashboard-nav";
import { WorkspaceSelectors } from "@/components/workspace/workspace-selectors";
import { Badge } from "@/components/ui/badge";
import { APP_NAME } from "@/lib/constants";
import {
  readCollapsedSections,
  readSidebarCollapsed,
  writeCollapsedSections,
  writeSidebarCollapsed,
} from "@/lib/navigation/sidebar-state";
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

  if (href === "/organic-social" && (pathname.startsWith("/organic-social") || pathname.startsWith("/social"))) {
    return true;
  }

  if (href === "/content/studio" && pathname.startsWith("/content")) {
    return true;
  }

  if (href === "/analytics" && pathname.startsWith("/analytics")) {
    return true;
  }

  if (href === "/copilot" && pathname.startsWith("/copilot")) {
    return true;
  }

  if (href === "/growth" && pathname.startsWith("/growth")) {
    return true;
  }

  if (href === "/operations" && pathname.startsWith("/operations")) {
    return true;
  }

  return pathname.startsWith(`${href}/`);
}

function NavLink({
  item,
  pathname,
  collapsed,
  onNavigate,
}: {
  item: NavigationItem;
  pathname: string;
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  const isActive = isNavItemActive(pathname, item.href);

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={cn(
        "relative flex items-center gap-3 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        collapsed ? "justify-center px-2" : "justify-between",
        isActive
          ? "bg-surface-selected text-foreground before:absolute before:left-0 before:top-1/2 before:h-5 before:w-0.5 before:-translate-y-1/2 before:rounded-full before:bg-paid-accent"
          : "text-foreground-muted hover:bg-surface-hover hover:text-foreground",
      )}
      aria-current={isActive ? "page" : undefined}
      title={collapsed ? item.label : item.description}
    >
      <span className={cn("flex min-w-0 items-center gap-3", collapsed && "justify-center")}>
        <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
        {!collapsed ? <span className="truncate">{item.label}</span> : null}
      </span>
      {!collapsed && item.comingSoon ? (
        <Badge variant="warning" className="shrink-0 text-[10px]">
          Soon
        </Badge>
      ) : null}
    </Link>
  );
}

function SidebarContent({
  pathname,
  collapsed,
  onNavigate,
}: {
  pathname: string;
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const [sectionState, setSectionState] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setSectionState(readCollapsedSections());
  }, []);

  function toggleSection(sectionId: string) {
    setSectionState((current) => {
      const next = { ...current, [sectionId]: !current[sectionId] };
      writeCollapsedSections(next);
      return next;
    });
  }

  return (
    <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-3">
      {dashboardNavigationSections.map((section) => {
        const isSectionCollapsed = sectionState[section.id] ?? false;

        return (
          <div key={section.id}>
            {!collapsed ? (
              <button
                type="button"
                onClick={() => toggleSection(section.id)}
                className="flex w-full items-center justify-between px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wide text-foreground-subtle hover:text-foreground-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-expanded={!isSectionCollapsed}
              >
                <span>{section.label}</span>
                <ChevronDown
                  className={cn(
                    "h-3.5 w-3.5 transition-transform",
                    isSectionCollapsed && "-rotate-90",
                  )}
                  aria-hidden="true"
                />
              </button>
            ) : null}
            {!isSectionCollapsed ? (
              <nav
                aria-label={`${section.label} navigation`}
                className={cn("mt-1 flex flex-col gap-0.5", collapsed && "mt-0")}
              >
                {section.items
          .filter((item) => !item.comingSoon)
          .map((item) => (
                  <NavLink
                    key={item.href}
                    item={item}
                    pathname={pathname}
                    collapsed={collapsed}
                    onNavigate={onNavigate}
                  />
                ))}
              </nav>
            ) : null}
          </div>
        );
      })}
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
                  Cresco
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
            <div className="border-t border-border p-4">
              <WorkspaceSelectors compact />
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}

export function DesktopSidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setCollapsed(readSidebarCollapsed());
  }, []);

  function toggleCollapsed() {
    setCollapsed((current) => {
      const next = !current;
      writeSidebarCollapsed(next);
      return next;
    });
  }

  return (
    <aside
      className={cn(
        "hidden shrink-0 border-r border-border bg-surface transition-[width] duration-200 lg:flex lg:flex-col",
        collapsed ? "w-[4.5rem]" : "w-64",
      )}
    >
      <div
        className={cn(
          "flex items-center border-b border-border px-4 py-4",
          collapsed ? "justify-center" : "justify-between",
        )}
      >
        {!collapsed ? (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-foreground-subtle">
              Cresco
            </p>
            <p className="mt-0.5 text-sm font-semibold text-foreground">{APP_NAME}</p>
          </div>
        ) : (
          <span className="text-sm font-bold text-foreground" title={APP_NAME}>
            C
          </span>
        )}
      </div>

      <SidebarContent pathname={pathname} collapsed={collapsed} />

      <div className="mt-auto border-t border-border p-3">
        {!collapsed ? (
          <div className="mb-3">
            <WorkspaceSelectors compact />
          </div>
        ) : null}
        <button
          type="button"
          onClick={toggleCollapsed}
          className={cn(
            "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-foreground-muted transition-colors hover:bg-surface-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            collapsed && "justify-center px-2",
          )}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          ) : (
            <>
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              <span>Collapse</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
