import { notFound } from "next/navigation";
import { DashboardPreviewShell } from "@/components/layout/dashboard-preview-shell";
import { CommandCentreDashboard } from "@/components/marketing/command-centre-dashboard";
import { CommandCentrePreviewProvider } from "@/components/marketing/command-centre-preview-context";
import { COMMAND_CENTRE_VISUAL_PREVIEW_FIXTURE } from "@/lib/command-centre/visual-preview-fixture";

export default function CommandCentreVisualPreviewPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return (
    <CommandCentrePreviewProvider data={COMMAND_CENTRE_VISUAL_PREVIEW_FIXTURE}>
      <DashboardPreviewShell>
        <div data-visual-preview="true">
          <CommandCentreDashboard />
        </div>
      </DashboardPreviewShell>
    </CommandCentrePreviewProvider>
  );
}
