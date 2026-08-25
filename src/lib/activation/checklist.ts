import type { ActivationMilestoneState } from "@/lib/activation/milestones";

export type ActivationChecklistItemStatus =
  | "complete"
  | "in_progress"
  | "pending"
  | "needs_action"
  | "waiting"
  | "requires_admin"
  | "skipped";

export type ActivationChecklistItem = {
  id: string;
  label: string;
  status: ActivationChecklistItemStatus;
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
  workspaceProviderConnected: boolean;
  syncInProgress: boolean;
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

function milestoneStatus(
  milestone: ActivationMilestoneState,
): ActivationChecklistItemStatus {
  if (milestone.inProgress) {
    return "in_progress";
  }
  if (milestone.complete) {
    return "complete";
  }
  return "pending";
}

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
        status: milestoneStatus(milestone),
        essential: true,
        href,
        summary: milestone.summary,
      } as ActivationChecklistItem;
    });

  const optional = input.milestones
    .filter((milestone) => !milestone.essential)
    .map((milestone) => ({
      id: milestone.key,
      label: milestone.label,
      status: milestoneStatus(milestone),
      essential: false,
      href: MILESTONE_ROUTES[milestone.key],
      summary: milestone.summary,
    }));

  const connectItem = essential.find((item) => item.id === "first_provider_connected");
  if (connectItem && !input.demoModeEnabled) {
    if (input.workspaceProviderConnected) {
      connectItem.status = "complete";
    } else if (input.syncInProgress) {
      connectItem.status = "waiting";
      connectItem.summary = "Initial sync is running.";
    } else if (!input.canManageIntegrations) {
      connectItem.status = "requires_admin";
      connectItem.consequence = "Requires an Organisation Owner or Admin to connect marketing data.";
    } else if (connectItem.status === "pending") {
      connectItem.status = "needs_action";
    }
  }

  const countableStatuses: ActivationChecklistItemStatus[] = ["complete"];

  return {
    essential,
    optional,
    essentialCompleted: essential.filter((item) => countableStatuses.includes(item.status)).length,
    essentialTotal: essential.length,
  };
}
