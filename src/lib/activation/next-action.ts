import type { ActivationHighLevelStatus, ActivationMilestoneState } from "@/lib/activation/milestones";

export type ActivationNextAction = {
  id: string;
  title: string;
  description: string;
  href: string;
  priority: number;
  unlocks?: string;
};

export type ActivationNextActionInput = {
  status: ActivationHighLevelStatus;
  milestones: ActivationMilestoneState[];
  brandId: string | null;
  onboardingCompleted: boolean;
  demoModeEnabled: boolean;
  syncInProgress: boolean;
  canManageIntegrations: boolean;
  invitedMember: boolean;
};

export function resolveActivationNextAction(
  input: ActivationNextActionInput,
): ActivationNextAction | null {
  const milestone = (key: string) => input.milestones.find((item) => item.key === key);
  const brandBase = input.brandId ? `/brands/${input.brandId}` : null;

  if (!input.onboardingCompleted && !input.invitedMember) {
    return {
      id: "continue-onboarding",
      title: "Continue setup",
      description: "Finish workspace onboarding to unlock guided activation.",
      href: "/onboarding",
      priority: 1,
    };
  }

  if (!milestone("organisation_ready")?.complete) {
    return {
      id: "create-organisation",
      title: "Create organisation",
      description: "Set up your organisation to begin using Cresco.",
      href: "/onboarding",
      priority: 2,
    };
  }

  if (!milestone("brand_ready")?.complete) {
    return {
      id: "create-brand",
      title: "Create brand",
      description: "Add the brand Cresco should help you grow.",
      href: "/onboarding",
      priority: 3,
    };
  }

  if (!milestone("minimum_brand_knowledge")?.complete) {
    return {
      id: "add-brand-knowledge",
      title: "Add audience context",
      description: "Complete essential Brand Knowledge for better AI drafts.",
      href: brandBase ? `${brandBase}/knowledge` : "/onboarding",
      priority: 4,
      unlocks: "AI content generation",
    };
  }

  if (
    !input.demoModeEnabled &&
    !milestone("first_provider_connected")?.complete &&
    input.canManageIntegrations
  ) {
    return {
      id: "connect-provider",
      title: "Connect GA4 or social account",
      description: "Connect a data source to unlock analytics and publishing.",
      href: "/integrations",
      priority: 5,
      unlocks: "Analytics, publishing, and insights",
    };
  }

  if (input.syncInProgress && !milestone("initial_sync_complete")?.complete) {
    return {
      id: "create-while-syncing",
      title: "Create first content",
      description: "Initial sync is running. You can create content while analytics load.",
      href: input.brandId ? `/content/studio/new?brandId=${input.brandId}` : "/content/studio",
      priority: 6,
    };
  }

  if (!milestone("first_content_created")?.complete) {
    return {
      id: "create-first-content",
      title: "Create your first Cresco-powered content",
      description: "Use Brand Knowledge to generate your first AI brief and master content.",
      href: input.brandId ? `/content/studio/new?brandId=${input.brandId}` : "/content/studio",
      priority: 7,
      unlocks: "Content Studio AI workflow",
    };
  }

  if (!milestone("first_variant_created")?.complete) {
    return {
      id: "create-variant",
      title: "Create channel variant",
      description: "Adapt your content for a connected social channel.",
      href: "/content/studio",
      priority: 8,
    };
  }

  if (!milestone("first_publication_scheduled")?.complete) {
    return {
      id: "schedule-publication",
      title: "Schedule publication",
      description: "Choose an account, validate, and schedule or publish your content.",
      href: "/publishing",
      priority: 9,
    };
  }

  if (!milestone("first_recommendation_generated")?.complete) {
    return {
      id: "review-insight",
      title: "Review first insight",
      description: "Open Command Centre to review your first Cresco recommendation.",
      href: "/dashboard",
      priority: 10,
    };
  }

  if (input.status !== "completed") {
    return {
      id: "improve-setup",
      title: "Improve your Cresco setup",
      description: "Optional steps remain to strengthen intelligence and automation.",
      href: "/getting-started",
      priority: 20,
    };
  }

  return null;
}
