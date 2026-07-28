import { PageHeader } from "@/components/layout/page-header";
import { ModuleEmptyState } from "@/components/layout/module-empty-state";

export default function CalendarPage() {
  return (
    <>
      <PageHeader
        title="Content Calendar"
        description="Plan campaigns and coordinate publishing schedules across channels."
        breadcrumbs={[{ label: "Overview", href: "/dashboard" }, { label: "Content Calendar" }]}
      />
      <ModuleEmptyState
        title="Campaign calendar"
        description="The calendar will provide a unified view of planned content, launches, and channel commitments."
        futureCapabilities={[
          "Cross-channel publishing schedule",
          "Campaign milestone tracking",
          "Team assignment and approvals",
          "Calendar sync with external tools",
        ]}
      />
    </>
  );
}
