"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import { dashboardNavigation } from "@/components/navigation/dashboard-nav";
import { Badge } from "@/components/ui/badge";
import { APP_NAME } from "@/lib/constants";
import { cn } from "@/lib/utils";

function NavLink({
  item,
  pathname,
  onNavigate,
}: {
  item: (typeof dashboardNavigation)[number];
  pathname: string;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  const isActive =
    pathname === item.href ||
    (item.href === "/knowledge" && pathname.includes("/knowledge")) ||
    (item.href === "/assets" && pathname.includes("/assets"));

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={cn(
        "flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400",
        isActive
          ? "bg-slate-900 text-white"
          : "text-slate-700 hover:bg-slate-100 hover:text-slate-900",
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

export function SidebarNav() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white p-2 text-slate-700 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 lg:hidden"
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
            className="absolute inset-0 bg-slate-900/40"
            aria-label="Close navigation overlay"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative flex h-full w-72 max-w-[85vw] flex-col bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Workspace
                </p>
                <p className="text-sm font-semibold text-slate-900">{APP_NAME}</p>
              </div>
              <button
                type="button"
                className="rounded-lg p-2 text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                onClick={() => setMobileOpen(false)}
              >
                <span className="sr-only">Close navigation</span>
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav aria-label="Main navigation" className="flex flex-1 flex-col gap-1 overflow-y-auto p-4">
              {dashboardNavigation.map((item) => (
                <NavLink
                  key={item.href}
                  item={item}
                  pathname={pathname}
                  onNavigate={() => setMobileOpen(false)}
                />
              ))}
            </nav>
          </aside>
        </div>
      ) : null}
    </>
  );
}

export function DesktopSidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-64 shrink-0 border-r border-slate-200 bg-white lg:flex lg:flex-col">
      <div className="border-b border-slate-200 px-6 py-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Workspace</p>
        <p className="mt-1 text-sm font-semibold text-slate-900">{APP_NAME}</p>
      </div>
      <nav aria-label="Main navigation" className="flex flex-1 flex-col gap-1 overflow-y-auto p-4">
        {dashboardNavigation.map((item) => (
          <NavLink key={item.href} item={item} pathname={pathname} />
        ))}
      </nav>
    </aside>
  );
}
