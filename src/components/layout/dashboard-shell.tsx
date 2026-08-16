import { DashboardHeader } from "@/components/layout/dashboard-header";
import { CopilotShell } from "@/components/copilot/copilot-shell";
import { DesktopSidebar } from "@/components/navigation/sidebar-nav";
import { WorkspaceProvider } from "@/components/workspace/workspace-provider";

type DashboardShellProps = {
  children: React.ReactNode;
};

export function DashboardShell({ children }: DashboardShellProps) {
  return (
    <WorkspaceProvider>
      <CopilotShell>
        <div className="min-h-screen bg-background">
          <div className="flex min-h-screen">
            <DesktopSidebar />
            <div className="flex min-w-0 flex-1 flex-col">
              <DashboardHeader />
              <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
            </div>
          </div>
        </div>
      </CopilotShell>
    </WorkspaceProvider>
  );
}
