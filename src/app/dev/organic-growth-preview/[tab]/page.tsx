import { notFound } from "next/navigation";
import { DashboardPreviewShell } from "@/components/layout/dashboard-preview-shell";
import { OrganicGrowthPreviewProvider } from "@/components/organic-growth/organic-growth-preview-context";
import { OrganicGrowthShell } from "@/components/organic-growth/organic-growth-shell";
import { GrowthWorkspace } from "@/components/organic-growth/growth-workspace";
import { AccountsWorkspace } from "@/components/organic-growth/accounts-workspace";
import { PublishingWorkspace } from "@/components/organic-growth/publishing-workspace";
import { ORGANIC_GROWTH_VISUAL_PREVIEW_FIXTURE } from "@/lib/organic-growth/visual-preview-fixture";

type PreviewTab = "overview" | "growth" | "accounts" | "publishing";

function resolveTab(value: string | undefined): PreviewTab {
  if (value === "growth" || value === "accounts" || value === "publishing") {
    return value;
  }
  return "overview";
}

export default async function OrganicGrowthPreviewTabPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  const params = await searchParams;
  const tab = resolveTab(params.tab);

  return (
    <OrganicGrowthPreviewProvider data={ORGANIC_GROWTH_VISUAL_PREVIEW_FIXTURE}>
      <DashboardPreviewShell>
        <div data-visual-preview="true" data-preview-tab={tab}>
          <OrganicGrowthShell>
            {tab === "growth" ? (
              <GrowthWorkspace />
            ) : tab === "accounts" ? (
              <AccountsWorkspace />
            ) : tab === "publishing" ? (
              <PublishingWorkspace />
            ) : null}
          </OrganicGrowthShell>
        </div>
      </DashboardPreviewShell>
    </OrganicGrowthPreviewProvider>
  );
}
