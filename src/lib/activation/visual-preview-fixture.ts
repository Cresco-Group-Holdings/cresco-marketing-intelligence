import type { ActivationChecklist } from "@/lib/activation/checklist";
import type { ActivationNextAction } from "@/lib/activation/next-action";
import type { ActivationState } from "@/server/services/activation-service";

function checklistItem(
  id: string,
  label: string,
  status: ActivationChecklist["essential"][number]["status"],
  essential = true,
): ActivationChecklist["essential"][number] {
  return { id, label, status, essential };
}

const baseChecklist: ActivationChecklist = {
  essential: [
    checklistItem("organisation_ready", "Organisation", "complete"),
    checklistItem("brand_ready", "Brand", "complete"),
    checklistItem("minimum_brand_knowledge", "Brand Knowledge", "pending"),
    checklistItem("first_provider_connected", "Connect data", "needs_action"),
    checklistItem("first_content_created", "Create first content", "pending"),
    checklistItem("first_publication_scheduled", "Schedule publication", "pending"),
    checklistItem("first_recommendation_generated", "First insight", "pending"),
  ],
  optional: [
    checklistItem("initial_sync_complete", "Initial sync", "pending", false),
    checklistItem("first_analytics_observation", "Analytics available", "pending", false),
  ],
  essentialCompleted: 2,
  essentialTotal: 7,
};

const nextAction: ActivationNextAction = {
  id: "add-brand-knowledge",
  title: "Complete core Brand Knowledge",
  description: "Complete essential Brand Knowledge for better AI drafts.",
  href: "/brands/brand-preview/knowledge",
  priority: 4,
  unlocks: "AI content generation",
};

export const ONBOARDING_VISUAL_PREVIEW_SCENES = {
  welcome: "welcome",
  brand: "brand",
  "brand-knowledge": "brand-knowledge",
  integrations: "integrations",
  sync: "sync",
  "first-content": "first-content",
  success: "success",
  "command-centre-checklist": "command-centre-checklist",
  "demo-entry": "demo-entry",
  "requires-admin": "requires-admin",
} as const;

export type OnboardingVisualPreviewScene =
  (typeof ONBOARDING_VISUAL_PREVIEW_SCENES)[keyof typeof ONBOARDING_VISUAL_PREVIEW_SCENES];

export function buildOnboardingPreviewActivation(
  scene: OnboardingVisualPreviewScene,
): ActivationState {
  const checklist = structuredClone(baseChecklist);

  switch (scene) {
    case "brand-knowledge":
      checklist.essential[2].status = "in_progress";
      break;
    case "integrations":
      checklist.essential[2].status = "complete";
      checklist.essential[3].status = "needs_action";
      checklist.essentialCompleted = 3;
      break;
    case "sync":
      checklist.essential[2].status = "complete";
      checklist.essential[3].status = "complete";
      checklist.optional[0].status = "waiting";
      checklist.essentialCompleted = 4;
      break;
    case "first-content":
      checklist.essential[2].status = "complete";
      checklist.essential[3].status = "complete";
      checklist.optional[0].status = "complete";
      checklist.essential[4].status = "needs_action";
      checklist.essentialCompleted = 4;
      break;
    case "success":
      checklist.essential.forEach((item) => {
        item.status = "complete";
      });
      checklist.optional.forEach((item) => {
        item.status = "complete";
      });
      checklist.essentialCompleted = 7;
      break;
    case "requires-admin":
      checklist.essential[2].status = "complete";
      checklist.essential[3].status = "requires_admin";
      checklist.essential[3].consequence =
        "Requires an Organisation Owner or Admin to connect marketing data.";
      checklist.essentialCompleted = 3;
      break;
    case "command-centre-checklist":
      checklist.essential[5].status = "complete";
      checklist.essential[6].status = "complete";
      checklist.essentialCompleted = 7;
      break;
    default:
      break;
  }

  return {
    status: scene === "success" || scene === "command-centre-checklist" ? "activated" : "in_progress",
    isActivated: scene === "success" || scene === "command-centre-checklist",
    demoProductExperienced: scene === "demo-entry",
    readyForFirstValue: scene !== "welcome",
    essentialCompleted: checklist.essentialCompleted,
    essentialTotal: checklist.essentialTotal,
    demoModeEnabled: scene === "demo-entry",
    demoLabel: scene === "demo-entry" ? "Demo Data" : null,
    invitedMember: scene === "requires-admin",
    onboardingCompleted: scene !== "welcome",
    syncInProgress: scene === "sync",
    preferences: {
      goal: "create_better_content",
      persona: "Marketing Lead",
      channels: ["LINKEDIN", "INSTAGRAM"],
    },
    brandKnowledge:
      scene === "welcome"
        ? null
        : {
            essential: {
              label: "Essential",
              tier: "essential",
              complete: scene !== "brand",
              filled: scene === "brand" ? 1 : 4,
              total: 4,
              guidance: "Add audience, positioning, and voice for strong AI drafts.",
              fields: [],
            },
            recommended: {
              label: "Recommended",
              tier: "recommended",
              complete: false,
              filled: 2,
              total: 6,
              guidance: "Optional context improves intelligence over time.",
              fields: [],
            },
          },
    checklist,
    nextAction,
    providerRecommendations: {
      recommended: [
        {
          providerKey: "google_analytics_4",
          label: "Google Analytics 4",
          category: "website_analytics",
          unlocks: ["Analytics", "Attribution"],
          connectHref: "/integrations?provider=google_analytics_4",
          priority: 1,
        },
      ],
      optional: [],
    },
    workspace: {
      organisation: { id: "org-preview", name: "Acme Marketing" },
      project: { id: "project-preview", name: "Growth" },
      brand: { id: "brand-preview", name: "Acme Brand" },
    },
    degradedSources: [],
  };
}
