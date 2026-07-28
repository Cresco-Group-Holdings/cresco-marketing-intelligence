import { PageHeader } from "@/components/layout/page-header";
import { ModuleEmptyState } from "@/components/layout/module-empty-state";

export default function ContentPage() {
  return (
    <>
      <PageHeader
        title="Content Studio"
        description="Draft, review, and prepare marketing assets for publication."
        breadcrumbs={[{ label: "Overview", href: "/dashboard" }, { label: "Content Studio" }]}
      />
      <ModuleEmptyState
        title="Content production workspace"
        description="Content Studio will support briefs, drafts, approvals, and AI-assisted production workflows."
        futureCapabilities={[
          "Campaign brief templates",
          "Collaborative drafting and review",
          "Brand-aware AI content assistance",
          "Asset versioning and export",
        ]}
      />
    </>
  );
}
