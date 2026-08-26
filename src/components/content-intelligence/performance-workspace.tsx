"use client";

import { PageHeader } from "@/components/layout/page-header";
import { MetricCardGrid } from "@/components/command-centre/metric-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardSkeleton } from "@/components/ui/skeleton";
import { WorkspaceErrorState } from "@/components/layout/workspace-empty-state";
import { ContentLearningPanel } from "@/components/content-intelligence/content-learning-panel";
import { useContentIntelligence } from "@/components/content-intelligence/use-content-intelligence";
import { formatMetricValue } from "@/lib/content-intelligence/performance";
import { unavailableValue } from "@/lib/marketing-intelligence/format";

export function PerformanceWorkspace() {
  const { data, loading, error, reload } = useContentIntelligence();

  if (loading && !data) return <DashboardSkeleton />;
  if (error && !data) {
    return (
      <WorkspaceErrorState title="Couldn't load performance" description={error} onRetry={reload} />
    );
  }
  if (!data) return null;

  const reachTotal = data.themePerformance.reduce((sum, row) => sum + (row.reach ?? 0), 0);
  const engagementTotal = data.themePerformance.reduce((sum, row) => sum + (row.engagement ?? 0), 0);

  const kpis = [
    {
      label: "Reach",
      value: reachTotal > 0 ? formatMetricValue(reachTotal) : unavailableValue(),
      state: reachTotal > 0 ? ("normal" as const) : ("empty" as const),
    },
    {
      label: "Engagement",
      value: engagementTotal > 0 ? formatMetricValue(engagementTotal) : unavailableValue(),
      state: engagementTotal > 0 ? ("normal" as const) : ("empty" as const),
    },
    {
      label: "Winning content",
      value: String(data.topPerforming.filter((t) => t.classification === "winning").length || unavailableValue()),
      state: data.topPerforming.length > 0 ? ("normal" as const) : ("empty" as const),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Content Performance"
        description="Normalized performance by theme, format, and channel."
      />

      <MetricCardGrid metrics={kpis} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">By theme</CardTitle>
          </CardHeader>
          <CardContent>
            {data.themePerformance.length === 0 ? (
              <p className="text-sm text-foreground-muted">Insufficient performance data.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-foreground-subtle">
                    <th className="pb-2">Theme</th>
                    <th className="pb-2">Reach</th>
                    <th className="pb-2">Engagement</th>
                    <th className="pb-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.themePerformance.map((row) => (
                    <tr key={row.theme} className="border-t border-border">
                      <td className="py-2">{row.label}</td>
                      <td className="py-2 tabular-nums">{formatMetricValue(row.reach)}</td>
                      <td className="py-2 tabular-nums">{formatMetricValue(row.engagement)}</td>
                      <td className="py-2 capitalize text-xs">{row.classification.replace(/_/g, " ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Top content</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {data.topPerforming.map((item) => (
                <li key={item.id} className="flex justify-between gap-2 text-sm">
                  <div>
                    <p className="font-medium">{item.title}</p>
                    <p className="text-xs text-foreground-muted">{item.channel}</p>
                  </div>
                  <div className="text-right">
                    <p className="tabular-nums">{item.metricValue}</p>
                    <p className="text-xs capitalize text-foreground-subtle">
                      {item.classification}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      {data.learnings.length > 0 ? <ContentLearningPanel learnings={data.learnings} /> : null}
    </div>
  );
}
