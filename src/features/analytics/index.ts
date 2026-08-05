export const analyticsFeature = {
  name: "analytics",
  status: "active",
  performanceCorePath: "/analytics/performance",
  api: {
    facts: "/api/analytics/facts",
    imports: "/api/analytics/imports",
    snapshots: "/api/analytics/snapshots",
    dashboards: {
      executive: "/api/analytics/dashboard/executive",
      campaigns: "/api/analytics/dashboard/campaigns",
      channels: "/api/analytics/dashboard/channels",
      kpiProgress: "/api/analytics/dashboard/kpi-progress",
      budgetPacing: "/api/analytics/dashboard/budget-pacing",
      freshness: "/api/analytics/dashboard/freshness",
      anomalies: "/api/analytics/dashboard/anomalies",
    },
  },
};
