import { notFound } from "next/navigation";
import { DashboardPreviewShell } from "@/components/layout/dashboard-preview-shell";
import { ContentIntelligencePreviewProvider } from "@/components/content-intelligence/content-intelligence-preview-context";
import { ContentIntelligenceShell } from "@/components/content-intelligence/content-intelligence-shell";
import { ContentStudioOverview } from "@/components/content-intelligence/overview-dashboard";
import { StrategyWorkspace } from "@/components/content-intelligence/strategy-workspace";
import { CreateWorkspace } from "@/components/content-intelligence/create-workspace";
import { PerformanceWorkspace } from "@/components/content-intelligence/performance-workspace";
import { WorkflowWorkspace } from "@/components/content-intelligence/workflow-workspace";
import { CONTENT_INTELLIGENCE_VISUAL_PREVIEW_FIXTURE } from "@/lib/content-intelligence/visual-preview-fixture";

type PreviewTab = "overview" | "strategy" | "create" | "performance" | "workflow";

function resolveTab(value: string | undefined): PreviewTab {
  if (
    value === "strategy" ||
    value === "create" ||
    value === "performance" ||
    value === "workflow"
  ) {
    return value;
  }
  return "overview";
}

export default async function ContentIntelligencePreviewTabPage({
  params,
}: {
  params: Promise<{ tab: string }>;
}) {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  const { tab: tabParam } = await params;
  const tab = resolveTab(tabParam);

  return (
    <ContentIntelligencePreviewProvider data={CONTENT_INTELLIGENCE_VISUAL_PREVIEW_FIXTURE}>
      <DashboardPreviewShell>
        <div data-visual-preview="true" data-preview-tab={tab}>
          <ContentIntelligenceShell>
            {tab === "strategy" ? (
              <StrategyWorkspace />
            ) : tab === "create" ? (
              <CreateWorkspace />
            ) : tab === "performance" ? (
              <PerformanceWorkspace />
            ) : tab === "workflow" ? (
              <WorkflowWorkspace />
            ) : (
              <ContentStudioOverview />
            )}
          </ContentIntelligenceShell>
        </div>
      </DashboardPreviewShell>
    </ContentIntelligencePreviewProvider>
  );
}
