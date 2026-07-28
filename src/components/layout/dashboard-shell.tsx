import { DashboardHeader } from "@/components/layout/dashboard-header";
import { DesktopSidebar } from "@/components/navigation/sidebar-nav";

type DashboardShellProps = {
  children: React.ReactNode;
  userEmail?: string;
};

export function DashboardShell({ children, userEmail }: DashboardShellProps) {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="flex min-h-screen">
        <DesktopSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <DashboardHeader userEmail={userEmail} />
          <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
