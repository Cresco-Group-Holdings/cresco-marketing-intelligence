import { PageHeader } from "@/components/layout/page-header";
import { ModuleEmptyState } from "@/components/layout/module-empty-state";

export default function AiAgentsPage() {
  return (
    <>
      <PageHeader
        title="AI Agents"
        description="Configure governed AI workflows for marketing planning and optimisation."
        breadcrumbs={[{ label: "Overview", href: "/dashboard" }, { label: "AI Agents" }]}
      />
      <ModuleEmptyState
        title="AI-assisted workflows"
        description="AI agents for content, recommendations, and growth analysis will be introduced after provider and governance foundations are complete."
        futureCapabilities={[
          "Provider selection and routing",
          "Prompt templates with brand guardrails",
          "Human-in-the-loop approvals",
          "Audit trails for AI-assisted actions",
        ]}
      />
    </>
  );
}
