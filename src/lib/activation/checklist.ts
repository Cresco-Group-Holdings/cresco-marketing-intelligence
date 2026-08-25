import type { ActivationMilestoneState } from "@/lib/activation/milestones";

export type ActivationChecklistItem = {
  id: string;
  label: string;
  status: "complete" | "in_progress" | "pending" | "skipped";
  essential: boolean;
  href?: string;
  consequence?: string;
  summary?: string;
};

export type ActivationChecklist = {
  essential: ActivationChecklistItem[];
  optional: ActivationChecklistItem[];
  essentialCompleted: number;
  essentialTotal: number;
};

export type ActivationChecklistInput = {
  milestones: ActivationMilestoneState[];
  brandId: string | null;
  canManageIntegrations: boolean;
  demoModeEnabled: boolean;
};

const MILESTONE_ROUTES: Partial<Record<string, string>> = {
  organisation_ready: "/onboarding",
  brand_ready: "/onboarding",
  minimum_brand_knowledge: "/brands",
  first_provider_connected: "/integrations",
  first_content_created: "/content/studio",
  first_publication_scheduled: "/publishing",
  first_recommendation_generated: "/dashboard",
};

export function buildActivationChecklist(input: ActivationChecklistInput): ActivationChecklist {
  const brandKnowledgeHref = input.brandId ? `/brands/${input.brandId}/knowledge` : "/onboarding";
  const contentHref = input.brandId ? `/content/studio/new?brandId=${input.brandId}` : "/content/studio";

  const essential = input.milestones
    .filter((milestone) => milestone.essential)
    .map((milestone) => {
      const href =
        milestone.key === "minimum_brand_knowledge"
          ? brandKnowledgeHref
          : milestone.key === "first_content_created"
            ? contentHref
            : MILESTONE_ROUTES[milestone.key];

      return {
        id: milestone.key,
        label: milestone.label,
        status: milestone.inProgress
          ? "in_progress"
          : milestone.complete
            ? "complete"
            : "pending",
        essential: true,
        href,
        summary: milestone.summary,
      } satisfies ActivationChecklistItem;
    });

  const optional = input.milestones
    .filter((milestone) => !milestone.essential)
    .map((milestone) => ({
      id: milestone.key,
      label: milestone.label,
      status: milestone.inProgress
        ? "in_progress"
        : milestone.complete
          ? "complete"
          : "pending",
      essential: false,
      href: MILESTONE_ROUTES[milestone.key],
      summary: milestone.summary,
    }));

  if (!input.canManageIntegrations && !input.demoModeEnabled) {
    const connectItem = essential.find((item) => item.id === "first_provider_connected");
    if (connectItem && connectItem.status === "pending") {
      connectItem.status = "skipped";
      connectItem.consequence = "Ask an organisation admin to connect marketing data sources.";
    }
  }

  return {
    essential,
    optional,
    essentialCompleted: essential.filter((item) => item.status === "complete").length,
    essentialTotal: essential.length,
  };
}
