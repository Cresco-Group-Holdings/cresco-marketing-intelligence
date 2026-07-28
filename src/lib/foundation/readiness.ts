import type { KnowledgeReadinessResult } from "@/lib/brand-knowledge/readiness";
import { hasEssentialBrandProfileFields } from "@/lib/brand-profile/completeness";

export type FoundationReadinessCategory =
  | "workspace"
  | "brand_profile"
  | "audience"
  | "offer"
  | "messaging"
  | "assets"
  | "connectors"
  | "ai_configuration"
  | "marketing_objectives";

export type FoundationReadinessStatus =
  | "completed"
  | "incomplete"
  | "blocked"
  | "not_yet_available";

export type FoundationReadinessItem = {
  category: FoundationReadinessCategory;
  label: string;
  status: FoundationReadinessStatus;
  summary: string;
  score?: number;
};

export type FoundationReadinessInput = {
  hasOrganisation: boolean;
  hasProject: boolean;
  hasBrand: boolean;
  onboardingCompleted: boolean;
  brandProfileComplete: boolean;
  knowledgeReadiness: KnowledgeReadinessResult | null;
  marketingAssetCount: number;
  approvedMarketingAssetCount: number;
  hasLogo: boolean;
  connectedConnectorCount: number;
  availableConnectorCount: number;
  aiProvidersConfigured: number;
  aiProvidersTotal: number;
  marketingObjectiveCount: number;
};

export const FOUNDATION_READINESS_LABELS: Record<FoundationReadinessCategory, string> = {
  workspace: "Workspace",
  brand_profile: "Brand Profile",
  audience: "Audience",
  offer: "Offer",
  messaging: "Messaging",
  assets: "Assets",
  connectors: "Connectors",
  ai_configuration: "AI Configuration",
  marketing_objectives: "Marketing Objectives",
};

function knowledgeCategoryScore(
  readiness: KnowledgeReadinessResult | null,
  category: "audience" | "offer" | "messaging" | "assets",
): number | undefined {
  return readiness?.categories.find((item) => item.category === category)?.score;
}

function knowledgeCategoryComplete(
  readiness: KnowledgeReadinessResult | null,
  category: "audience" | "offer" | "messaging" | "assets",
): boolean {
  const score = knowledgeCategoryScore(readiness, category);
  return score === 100;
}

export function calculateFoundationReadiness(
  input: FoundationReadinessInput,
): FoundationReadinessItem[] {
  const brandBlocked = !input.hasBrand;

  const workspaceStatus: FoundationReadinessStatus = !input.hasOrganisation
    ? "blocked"
    : input.hasOrganisation && input.hasProject && input.hasBrand
      ? "completed"
      : "incomplete";

  const brandProfileStatus: FoundationReadinessStatus = brandBlocked
    ? "blocked"
    : input.brandProfileComplete
      ? "completed"
      : "incomplete";

  const audienceStatus: FoundationReadinessStatus = brandBlocked
    ? "blocked"
    : knowledgeCategoryComplete(input.knowledgeReadiness, "audience")
      ? "completed"
      : "incomplete";

  const offerStatus: FoundationReadinessStatus = brandBlocked
    ? "blocked"
    : knowledgeCategoryComplete(input.knowledgeReadiness, "offer")
      ? "completed"
      : "incomplete";

  const messagingStatus: FoundationReadinessStatus = brandBlocked
    ? "blocked"
    : knowledgeCategoryComplete(input.knowledgeReadiness, "messaging")
      ? "completed"
      : "incomplete";

  const assetsStatus: FoundationReadinessStatus = brandBlocked
    ? "blocked"
    : input.hasLogo && input.marketingAssetCount > 0
      ? "completed"
      : input.marketingAssetCount > 0 || input.hasLogo
        ? "incomplete"
        : "incomplete";

  let connectorsStatus: FoundationReadinessStatus = "not_yet_available";
  if (input.availableConnectorCount > 0) {
    connectorsStatus =
      input.connectedConnectorCount > 0
        ? "completed"
        : brandBlocked
          ? "blocked"
          : "incomplete";
  } else if (!brandBlocked) {
    connectorsStatus = "not_yet_available";
  } else {
    connectorsStatus = "blocked";
  }

  const aiStatus: FoundationReadinessStatus =
    input.aiProvidersTotal === 0
      ? "not_yet_available"
      : input.aiProvidersConfigured > 0
        ? "completed"
        : "incomplete";

  const objectivesStatus: FoundationReadinessStatus = brandBlocked
    ? "blocked"
    : input.marketingObjectiveCount > 0
      ? "completed"
      : "incomplete";

  return [
    {
      category: "workspace",
      label: FOUNDATION_READINESS_LABELS.workspace,
      status: workspaceStatus,
      summary:
        workspaceStatus === "completed"
          ? "Organisation, project, and brand are selected."
          : workspaceStatus === "blocked"
            ? "Create or join an organisation to begin."
            : "Select an organisation, project, and brand.",
    },
    {
      category: "brand_profile",
      label: FOUNDATION_READINESS_LABELS.brand_profile,
      status: brandProfileStatus,
      summary: brandProfileStatus === "completed"
        ? "Essential brand profile fields are complete."
        : brandBlocked
          ? "Select a brand to assess profile readiness."
          : "Add essential profile details for the active brand.",
      score: input.knowledgeReadiness?.categories.find((item) => item.category === "identity")
        ?.score,
    },
    {
      category: "audience",
      label: FOUNDATION_READINESS_LABELS.audience,
      status: audienceStatus,
      summary:
        audienceStatus === "completed"
          ? "Audience segments and personas are configured."
          : brandBlocked
            ? "Select a brand to configure audience data."
            : "Add target audience segments and personas.",
      score: knowledgeCategoryScore(input.knowledgeReadiness, "audience"),
    },
    {
      category: "offer",
      label: FOUNDATION_READINESS_LABELS.offer,
      status: offerStatus,
      summary:
        offerStatus === "completed"
          ? "Product or service offers are documented."
          : brandBlocked
            ? "Select a brand to add offers."
            : "Add at least one product or service offer.",
      score: knowledgeCategoryScore(input.knowledgeReadiness, "offer"),
    },
    {
      category: "messaging",
      label: FOUNDATION_READINESS_LABELS.messaging,
      status: messagingStatus,
      summary:
        messagingStatus === "completed"
          ? "Core messaging and CTA library are in place."
          : brandBlocked
            ? "Select a brand to configure messaging."
            : "Complete messaging pillars and approved CTAs.",
      score: knowledgeCategoryScore(input.knowledgeReadiness, "messaging"),
    },
    {
      category: "assets",
      label: FOUNDATION_READINESS_LABELS.assets,
      status: assetsStatus,
      summary:
        assetsStatus === "completed"
          ? "Logo and marketing assets are available."
          : brandBlocked
            ? "Select a brand to upload assets."
            : "Upload a logo and approved marketing assets.",
      score: knowledgeCategoryScore(input.knowledgeReadiness, "assets"),
    },
    {
      category: "connectors",
      label: FOUNDATION_READINESS_LABELS.connectors,
      status: connectorsStatus,
      summary:
        connectorsStatus === "completed"
          ? `${input.connectedConnectorCount} data source(s) connected.`
          : connectorsStatus === "not_yet_available"
            ? "Platform connectors are not yet available for connection."
            : brandBlocked
              ? "Select a brand before connecting data sources."
              : "Connect your first marketing data source.",
    },
    {
      category: "ai_configuration",
      label: FOUNDATION_READINESS_LABELS.ai_configuration,
      status: aiStatus,
      summary:
        aiStatus === "completed"
          ? `${input.aiProvidersConfigured} AI provider(s) configured.`
          : aiStatus === "not_yet_available"
            ? "AI provider configuration is not available."
            : "Configure at least one AI provider for future agents.",
    },
    {
      category: "marketing_objectives",
      label: FOUNDATION_READINESS_LABELS.marketing_objectives,
      status: objectivesStatus,
      summary:
        objectivesStatus === "completed"
          ? `${input.marketingObjectiveCount} objective(s) configured.`
          : brandBlocked
            ? "Select a brand to add objectives."
            : "Add marketing objectives for the active brand.",
    },
  ];
}

export function isBrandProfileReady(
  profile: Parameters<typeof hasEssentialBrandProfileFields>[0] | null,
): boolean {
  if (!profile) {
    return false;
  }
  return hasEssentialBrandProfileFields(profile);
}
