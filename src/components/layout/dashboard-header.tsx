import { WorkspaceSelectors } from "@/components/workspace/workspace-selectors";
import { SidebarNav } from "@/components/navigation/sidebar-nav";
import { APP_NAME } from "@/lib/constants";

export function DashboardHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="flex h-auto min-h-16 flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex items-center gap-3">
          <div className="lg:hidden">
            <SidebarNav />
          </div>
          <div className="min-w-0 lg:hidden">
            <p className="truncate text-sm font-semibold text-slate-900">{APP_NAME}</p>
          </div>
          <div className="hidden lg:block">
            <WorkspaceSelectors />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 sm:justify-end">
          <div className="lg:hidden">
            <WorkspaceSelectors />
          </div>
        </div>
      </div>
    </header>
  );
}
