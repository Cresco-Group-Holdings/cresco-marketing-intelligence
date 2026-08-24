import { notFound } from "next/navigation";
import { DashboardPreviewShell } from "@/components/layout/dashboard-preview-shell";
import { OrganicGrowthPreviewProvider } from "@/components/organic-growth/organic-growth-preview-context";
import { OrganicGrowthShell } from "@/components/organic-growth/organic-growth-shell";
import { OrganicOverviewDashboardPage } from "@/components/organic-growth/organic-overview-dashboard";
import { ORGANIC_GROWTH_VISUAL_PREVIEW_FIXTURE } from "@/lib/organic-growth/visual-preview-fixture";

export default function OrganicGrowthVisualPreviewPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return (
    <OrganicGrowthPreviewProvider data={ORGANIC_GROWTH_VISUAL_PREVIEW_FIXTURE}>
      <DashboardPreviewShell>
        <div data-visual-preview="true">
          <OrganicGrowthShell>
            <OrganicOverviewDashboardPage />
          </OrganicGrowthShell>
        </div>
      </DashboardPreviewShell>
    </OrganicGrowthPreviewProvider>
  );
}
