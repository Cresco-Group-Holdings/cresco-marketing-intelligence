import { redirect } from "next/navigation";
import { DashboardPreviewShell } from "@/components/layout/dashboard-preview-shell";
import { CommandCentreDashboard } from "@/components/marketing/command-centre-dashboard";
import { CommandCentrePreviewProvider } from "@/components/marketing/command-centre-preview-context";
import { WorkspacePreviewProvider } from "@/components/workspace/workspace-preview-provider";
import { COMMAND_CENTRE_VISUAL_PREVIEW_FIXTURE } from "@/lib/command-centre/visual-preview-fixture";
import { activationService } from "@/server/services/activation-service";
import { requireAuthenticatedUser } from "@/lib/tenancy/guards";

export default async function DemoWorkspacePage() {
  const user = await requireAuthenticatedUser();
  const activation = await activationService.getState(user.userProfileId);

  if (!activation.demoModeEnabled && process.env.NODE_ENV === "production") {
    redirect("/getting-started");
  }

  return (
    <WorkspacePreviewProvider>
      <CommandCentrePreviewProvider data={COMMAND_CENTRE_VISUAL_PREVIEW_FIXTURE}>
        <DashboardPreviewShell>
          <div className="space-y-4" data-demo-workspace="true">
            <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <p className="font-semibold">Demo Data</p>
              <p className="mt-1">
                This workspace uses isolated sample data. No real publications, provider actions, or
                billing usage will occur.
              </p>
            </div>
            <CommandCentreDashboard />
          </div>
        </DashboardPreviewShell>
      </CommandCentrePreviewProvider>
    </WorkspacePreviewProvider>
  );
}
