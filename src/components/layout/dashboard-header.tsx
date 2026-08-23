import Link from "next/link";
import { HelpCircle } from "lucide-react";
import { requireAuthenticatedUser } from "@/lib/tenancy/guards";
import { UserMenu } from "@/components/auth/user-menu";
import { CopilotHeaderButton } from "@/components/copilot/copilot-shell";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { GlobalSearch } from "@/components/navigation/global-search";
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
      <div className="flex h-auto min-h-14 flex-col gap-3 px-4 py-3 lg:min-h-16 lg:flex-row lg:items-center lg:justify-between lg:px-6">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="lg:hidden">
            <SidebarNav />
          </div>
          <div className="min-w-0 lg:hidden">
            <p className="truncate text-sm font-semibold text-foreground">{APP_NAME}</p>
          </div>
          <div className="hidden min-w-0 flex-1 items-center gap-4 lg:flex">
            <WorkspaceSelectors />
            <GlobalSearch className="max-w-sm xl:max-w-md" />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 sm:justify-end">
          <div className="w-full lg:hidden">
            <GlobalSearch />
          </div>
          <div className="lg:hidden">
            <WorkspaceSelectors />
          </div>
          <CopilotHeaderButton />
          <Link
            href="/settings"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-surface text-foreground-muted transition-colors hover:bg-surface-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Help and settings"
            title="Help"
          >
            <HelpCircle className="h-4 w-4" aria-hidden="true" />
          </Link>
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
