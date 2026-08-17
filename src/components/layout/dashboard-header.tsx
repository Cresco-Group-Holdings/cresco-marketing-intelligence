import { requireAuthenticatedUser } from "@/lib/tenancy/guards";
import { UserMenu } from "@/components/auth/user-menu";
import { CopilotHeaderButton } from "@/components/copilot/copilot-shell";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { WorkspaceSelectors } from "@/components/workspace/workspace-selectors";
import { SidebarNav } from "@/components/navigation/sidebar-nav";
import { AppearanceMenu } from "@/components/theme/appearance-menu";
import { prisma } from "@/lib/database/prisma";
import { APP_NAME } from "@/lib/constants";

export async function DashboardHeader() {
  const user = await requireAuthenticatedUser();
  const profile = await prisma.userProfile.findUnique({
    where: { id: user.userProfileId },
    select: { displayName: true, email: true },
  });

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-surface-elevated/95 backdrop-blur">
      <div className="flex h-auto min-h-16 flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex items-center gap-3">
          <div className="lg:hidden">
            <SidebarNav />
          </div>
          <div className="min-w-0 lg:hidden">
            <p className="truncate text-sm font-semibold text-foreground">{APP_NAME}</p>
          </div>
          <div className="hidden lg:block">
            <WorkspaceSelectors />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 sm:justify-end">
          <div className="lg:hidden">
            <WorkspaceSelectors />
          </div>
          <CopilotHeaderButton />
          <AppearanceMenu />
          <NotificationBell />
          <UserMenu
            email={profile?.email ?? user.email}
            displayName={profile?.displayName}
          />
        </div>
      </div>
    </header>
  );
}
