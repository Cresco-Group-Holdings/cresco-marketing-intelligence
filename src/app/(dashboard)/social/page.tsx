import { PageHeader } from "@/components/layout/page-header";
import { ModuleEmptyState } from "@/components/layout/module-empty-state";

export default function SocialPage() {
  return (
    <>
      <PageHeader
        title="Social Media"
        description="Prepare social distribution workflows once publishing connectors are available."
        breadcrumbs={[{ label: "Overview", href: "/dashboard" }, { label: "Social Media" }]}
      />
      <ModuleEmptyState
        title="Social distribution"
        description="Social publishing and analytics are not connected in this release. This module will coordinate channel-ready content and scheduling."
        futureCapabilities={[
          "Channel account connections",
          "Post scheduling and approvals",
          "Platform-specific formatting",
          "Social performance reporting",
        ]}
      />
    </>
  );
}
