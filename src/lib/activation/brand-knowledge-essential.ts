import type { BrandKnowledgeSnapshot } from "@/lib/brand-knowledge/readiness";

export type BrandKnowledgeTier = "essential" | "recommended";

export type BrandKnowledgeTierField = {
  field: string;
  label: string;
  complete: boolean;
};

export type BrandKnowledgeTierResult = {
  tier: BrandKnowledgeTier;
  label: string;
  filled: number;
  total: number;
  complete: boolean;
  fields: BrandKnowledgeTierField[];
  guidance: string;
};

function hasText(value: string | null | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

export function evaluateEssentialBrandKnowledge(
  snapshot: BrandKnowledgeSnapshot | null,
): BrandKnowledgeTierResult {
  const activeAudiences = snapshot?.audiences.filter((item) => !item.archivedAt) ?? [];
  const activeOffers = snapshot?.offers.filter((item) => !item.archivedAt) ?? [];

  const fields: BrandKnowledgeTierField[] = [
    {
      field: "identity",
      label: "Brand identity",
      complete: hasText(snapshot?.brand.name) && hasText(snapshot?.profile?.shortDescription ?? snapshot?.brand.description),
    },
    {
      field: "audience",
      label: "Target audience",
      complete: activeAudiences.some((audience) => hasText(audience.name)),
    },
    {
      field: "offer",
      label: "Core offer",
      complete: activeOffers.some((offer) => hasText(offer.name)),
    },
    {
      field: "messaging",
      label: "Primary message",
      complete:
        hasText(snapshot?.messaging?.coreMessage) || hasText(snapshot?.messaging?.elevatorPitch),
    },
    {
      field: "voice",
      label: "Voice and tone",
      complete: hasText(snapshot?.voice?.preferredTone),
    },
  ];

  const filled = fields.filter((field) => field.complete).length;

  return {
    tier: "essential",
    label: "Essential context",
    filled,
    total: fields.length,
    complete: filled === fields.length,
    fields,
    guidance:
      filled === fields.length
        ? "Essential brand context is ready for AI content generation."
        : "Add the remaining essential fields to improve first-draft quality.",
  };
}

export function evaluateRecommendedBrandKnowledge(
  snapshot: BrandKnowledgeSnapshot | null,
): BrandKnowledgeTierResult {
  const activePersonas = snapshot?.personas.filter((item) => !item.archivedAt) ?? [];
  const activeCompetitors = snapshot?.competitors.filter((item) => !item.archivedAt) ?? [];
  const activeAssets = snapshot?.assets.filter((item) => !item.archivedAt) ?? [];
  const activeCompliance = snapshot?.complianceRules.filter((item) => !item.archivedAt) ?? [];

  const fields: BrandKnowledgeTierField[] = [
    {
      field: "personas",
      label: "Personas",
      complete: activePersonas.length > 0,
    },
    {
      field: "proof_points",
      label: "Proof points",
      complete: (snapshot?.messaging?.proofPoints?.length ?? 0) > 0,
    },
    {
      field: "competitors",
      label: "Competitors",
      complete: activeCompetitors.length > 0,
    },
    {
      field: "compliance",
      label: "Compliance guidance",
      complete: activeCompliance.length > 0 || hasText(snapshot?.profile?.complianceNotes),
    },
    {
      field: "vocabulary",
      label: "Preferred vocabulary",
      complete: (snapshot?.voice?.vocabulary?.length ?? 0) > 0,
    },
    {
      field: "assets",
      label: "Brand assets",
      complete: activeAssets.length > 0 || hasText(snapshot?.brand.logoUrl),
    },
    {
      field: "differentiators",
      label: "Differentiators",
      complete: (snapshot?.messaging?.differentiators?.length ?? 0) > 0,
    },
    {
      field: "cta_library",
      label: "CTA library",
      complete: (snapshot?.messaging?.ctaLibrary?.length ?? 0) > 0,
    },
  ];

  const filled = fields.filter((field) => field.complete).length;

  return {
    tier: "recommended",
    label: "Recommended context",
    filled,
    total: fields.length,
    complete: filled === fields.length,
    fields,
    guidance:
      filled === fields.length
        ? "Recommended context is complete."
        : "You can start generating content now. Completing proof points and compliance guidance will improve output quality.",
  };
}
