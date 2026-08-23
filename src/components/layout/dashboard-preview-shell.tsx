import { PreviewDashboardHeader } from "@/components/layout/preview-dashboard-header";
import { CopilotShell } from "@/components/copilot/copilot-shell";
import { DesktopSidebar } from "@/components/navigation/sidebar-nav";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { WorkspacePreviewProvider } from "@/components/workspace/workspace-preview-provider";

type DashboardPreviewShellProps = {
  children: React.ReactNode;
};

export function DashboardPreviewShell({ children }: DashboardPreviewShellProps) {
  return (
    <ThemeProvider>
      <WorkspacePreviewProvider>
        <CopilotShell>
          <div className="min-h-screen bg-background">
            <div className="flex min-h-screen">
              <DesktopSidebar />
              <div className="flex min-w-0 flex-1 flex-col">
                <PreviewDashboardHeader />
                <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-5 sm:px-5 lg:px-6">
                  {children}
                </main>
              </div>
            </div>
          </div>
        </CopilotShell>
      </WorkspacePreviewProvider>
    </ThemeProvider>
  );
}
