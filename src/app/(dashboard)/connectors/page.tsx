import { PageHeader } from "@/components/layout/page-header";
import { ModuleEmptyState } from "@/components/layout/module-empty-state";

export default function ConnectorsPage() {
  return (
    <>
      <PageHeader
        title="Connectors"
        description="Configure integrations with marketing platforms and data sources."
        breadcrumbs={[{ label: "Overview", href: "/dashboard" }, { label: "Connectors" }]}
      />
      <ModuleEmptyState
        title="Platform connectors"
        description="Connector management will centralise OAuth setup, credential storage, and sync status for external platforms."
        futureCapabilities={[
          "Google, Meta, LinkedIn, and TikTok OAuth",
          "Search Console and analytics sources",
          "Email and advertising platform links",
          "Connector health monitoring",
        ]}
      />
    </>
  );
}
