import { PageHeader } from "@/components/layout/page-header";
import { ModuleEmptyState } from "@/components/layout/module-empty-state";

export default function AnalyticsPage() {
  return (
    <>
      <PageHeader
        title="Analytics"
        description="Connect marketing performance data for actionable intelligence."
        breadcrumbs={[{ label: "Overview", href: "/dashboard" }, { label: "Analytics" }]}
      />
      <ModuleEmptyState
        title="Marketing intelligence"
        description="Analytics dashboards will appear once data connectors and event pipelines are configured. No sample metrics are shown at this stage."
        futureCapabilities={[
          "Website and search performance",
          "Campaign attribution views",
          "Channel comparison dashboards",
          "Custom report builder",
        ]}
      />
    </>
  );
}
