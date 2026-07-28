import { PageHeader } from "@/components/layout/page-header";
import { ModuleEmptyState } from "@/components/layout/module-empty-state";

export default function SettingsPage() {
  return (
    <>
      <PageHeader
        title="Settings"
        description="Manage organisation membership, security preferences, and workspace defaults."
        breadcrumbs={[{ label: "Overview", href: "/dashboard" }, { label: "Settings" }]}
      />
      <ModuleEmptyState
        title="Workspace settings"
        description="Organisation administration, member roles, and security controls will be configurable here."
        futureCapabilities={[
          "Member invitations and role management",
          "Organisation profile and defaults",
          "Security and audit preferences",
          "Notification and workspace policies",
        ]}
        comingSoon={false}
      />
    </>
  );
}
