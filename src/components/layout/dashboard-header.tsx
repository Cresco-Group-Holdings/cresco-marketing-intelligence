import Link from "next/link";
import { Bell, ChevronDown, LogOut, UserCircle2 } from "lucide-react";
import { APP_NAME } from "@/lib/constants";
import { SidebarNav } from "@/components/navigation/sidebar-nav";

type DashboardHeaderProps = {
  userEmail?: string;
};

export function DashboardHeader({ userEmail = "account@example.com" }: DashboardHeaderProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="flex h-16 items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex items-center gap-3 lg:hidden">
          <SidebarNav />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-900">{APP_NAME}</p>
          </div>
        </div>

        <div className="hidden items-center gap-3 lg:flex">
          <div>
            <p className="text-sm font-medium text-slate-900">Organisation</p>
            <p className="text-xs text-slate-500">Select organisation (placeholder)</p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <label className="hidden md:block">
            <span className="sr-only">Select project or brand</span>
            <select
              className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 focus-visible:border-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-200"
              defaultValue=""
              disabled
            >
              <option value="">Project / brand selector</option>
            </select>
          </label>

          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
            aria-label="Notifications (placeholder)"
          >
            <Bell className="h-4 w-4" />
          </button>

          <details className="relative">
            <summary className="inline-flex cursor-pointer list-none items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400">
              <UserCircle2 className="h-4 w-4" aria-hidden="true" />
              <span className="hidden max-w-[160px] truncate sm:inline">{userEmail}</span>
              <ChevronDown className="h-4 w-4" aria-hidden="true" />
            </summary>
            <div className="absolute right-0 mt-2 w-48 rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
              <Link
                href="/login"
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                <LogOut className="h-4 w-4" />
                Sign out (placeholder)
              </Link>
            </div>
          </details>
        </div>
      </div>
    </header>
  );
}
