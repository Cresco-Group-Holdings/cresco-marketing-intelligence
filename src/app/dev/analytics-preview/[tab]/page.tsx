import { notFound } from "next/navigation";
import { DashboardPreviewShell } from "@/components/layout/dashboard-preview-shell";
import { UnifiedAnalyticsPreviewProvider } from "@/components/analytics/unified-analytics-preview-context";
import { UnifiedAnalyticsShell } from "@/components/analytics/unified-analytics-shell";
import { UnifiedAnalyticsWorkspace } from "@/components/analytics/unified-analytics-workspace";
import {
  ANALYTICS_PARTIAL_DATA_FIXTURE,
  ANALYTICS_VISUAL_PREVIEW_FIXTURE,
} from "@/lib/unified-analytics/visual-preview-fixture";
import type { UnifiedAnalyticsTab } from "@/components/analytics/unified-analytics-workspace";

type PreviewTab =
  | "overview"
  | "channels"
  | "content"
  | "attribution"
  | "funnels"
  | "conversions"
  | "revenue"
  | "partial";

function resolveTab(value: string | undefined): PreviewTab {
  const valid: PreviewTab[] = [
    "overview",
    "channels",
    "content",
    "attribution",
    "funnels",
    "conversions",
    "revenue",
    "partial",
  ];
  if (value && valid.includes(value as PreviewTab)) {
    return value as PreviewTab;
  }
  return "overview";
}

function toWorkspaceTab(tab: PreviewTab): UnifiedAnalyticsTab {
  if (tab === "partial") return "overview";
  return tab;
}

export default async function AnalyticsPreviewTabPage({
  params,
}: {
  params: Promise<{ tab: string }>;
}) {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  const { tab: tabParam } = await params;
  const tab = resolveTab(tabParam);
  const fixture = tab === "partial" ? ANALYTICS_PARTIAL_DATA_FIXTURE : ANALYTICS_VISUAL_PREVIEW_FIXTURE;

  return (
    <UnifiedAnalyticsPreviewProvider data={fixture}>
      <DashboardPreviewShell>
        <div data-visual-preview="true" data-preview-tab={tab}>
          <UnifiedAnalyticsShell>
            <UnifiedAnalyticsWorkspace tab={toWorkspaceTab(tab)} />
          </UnifiedAnalyticsShell>
        </div>
      </DashboardPreviewShell>
    </UnifiedAnalyticsPreviewProvider>
  );
}
