import { requireAuthenticatedUser } from "@/lib/tenancy/guards";
import { PageHeader } from "@/components/layout/page-header";
import {
  FoundationMetricsCard,
  NextActionsCard,
  ObjectivesCard,
  ReadinessGrid,
  RecentActivityCard,
  WorkspaceOverviewCard,
} from "@/components/dashboard/foundation-dashboard";
import { foundationDashboardService } from "@/server/services/foundation-dashboard-service";

export default async function DashboardPage() {
  const user = await requireAuthenticatedUser();
  const data = await foundationDashboardService.getDashboard(user.userProfileId);

  return (
    <>
      <PageHeader
        title="Overview"
        description="Your operational starting point for Cresco Grants and Capital Cresco Terminal — based on real configuration, readiness, and connection states."
        breadcrumbs={[{ label: "Overview" }]}
      />

      <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
        <div className="space-y-6">
          <WorkspaceOverviewCard data={data} />
          <ReadinessGrid items={data.readiness} />
          <ObjectivesCard
            objectives={data.marketingObjectives}
            brandId={data.workspace.brand?.id ?? null}
          />
        </div>

        <div className="space-y-6">
          <FoundationMetricsCard data={data} />
          <NextActionsCard actions={data.nextActions} />
          <RecentActivityCard data={data} />
        </div>
      </div>
    </>
  );
}
