import { PageHeader } from "@/components/layout/page-header";
import { ModuleEmptyState } from "@/components/layout/module-empty-state";

export default function DashboardPage() {
  return (
    <>
      <PageHeader
        title="Overview"
        description="Your marketing command centre for organisations, projects, and brands."
        breadcrumbs={[{ label: "Overview" }]}
      />
      <ModuleEmptyState
        title="Workspace overview"
        description="The overview will summarise active brands, upcoming content, connector health, and AI recommendations once modules are connected."
        futureCapabilities={[
          "Organisation and project level KPIs",
          "Recent activity across content and campaigns",
          "Connector status and sync health",
          "Prioritised growth recommendations",
        ]}
      />
    </>
  );
}
