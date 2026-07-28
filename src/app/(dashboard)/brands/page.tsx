import { PageHeader } from "@/components/layout/page-header";
import { ModuleEmptyState } from "@/components/layout/module-empty-state";

export default function BrandsPage() {
  return (
    <>
      <PageHeader
        title="Brands"
        description="Manage brand identities, positioning, and voice guidelines across projects."
        breadcrumbs={[{ label: "Overview", href: "/dashboard" }, { label: "Brands" }]}
      />
      <ModuleEmptyState
        title="Brand management"
        description="Create and maintain brand profiles that guide content, campaigns, and channel execution."
        futureCapabilities={[
          "Brand voice and messaging guidelines",
          "Visual identity references",
          "Audience and market positioning",
          "Brand-level content defaults",
        ]}
      />
    </>
  );
}
