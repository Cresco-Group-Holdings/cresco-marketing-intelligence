import { DashboardHeader } from "@/components/layout/dashboard-header";
import { DesktopSidebar } from "@/components/navigation/sidebar-nav";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { WorkspaceProvider } from "@/components/workspace/workspace-provider";

type DashboardShellProps = {
  children: React.ReactNode;
};

export function DashboardShell({ children }: DashboardShellProps) {
  return (
    <ThemeProvider>
      <WorkspaceProvider>
        <div className="min-h-screen bg-background">
          <div className="flex min-h-screen">
            <DesktopSidebar />
            <div className="flex min-w-0 flex-1 flex-col">
              <DashboardHeader />
              <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
            </div>
          </div>
        </div>
      </WorkspaceProvider>
    </ThemeProvider>
  );
}
