import type { BrandContextReadiness } from "@/lib/content-intelligence/types";
import type { KnowledgeReadinessResult } from "@/lib/brand-knowledge/readiness";

const CATEGORY_LABELS: Record<string, string> = {
  identity: "Identity",
  audience: "Audience",
  offer: "Offers",
  messaging: "Messaging",
  voice: "Voice",
  compliance: "Compliance",
  assets: "Assets",
};

export function mapBrandReadinessForContent(
  readiness: KnowledgeReadinessResult,
  brandKnowledgeHref: string,
): BrandContextReadiness {
  const missing = readiness.categories.flatMap((category) =>
    category.missing.map((field) => ({
      category: CATEGORY_LABELS[category.category] ?? category.category,
      label: field.label,
    })),
  );

  const complete = readiness.overallScore >= 70 && missing.length <= 2;

  return {
    overallScore: readiness.overallScore,
    complete,
    missing: missing.slice(0, 8),
    impactMessage: complete
      ? "Brand context is sufficient for intelligence-led content production."
      : "Cresco can still generate drafts, but brand alignment may be weaker until key profile fields are completed.",
    completeBrandHref: brandKnowledgeHref,
  };
}

export type ResolvedBrandContext = {
  brandName: string;
  shortDescription: string | null;
  valueProposition: string | null;
  mission: string | null;
  targetAudience: string | null;
  keyBenefits: string | null;
  preferredTone: string | null;
  prohibitedTone: string | null;
  coreMessage: string | null;
  tagline: string | null;
  audiences: Array<{ id: string; name: string; description: string | null }>;
  personas: Array<{ id: string; name: string; summary: string | null }>;
  offers: Array<{ id: string; name: string; description: string | null }>;
  competitors: Array<{ id: string; name: string; notes: string | null }>;
  prohibitedClaims: string[];
  mandatoryDisclosures: string[];
  prohibitedVocabulary: string[];
};

export function buildResolvedBrandContext(input: {
  brandName: string;
  profile: {
    shortDescription?: string | null;
    valueProposition?: string | null;
    mission?: string | null;
    targetAudience?: string | null;
    keyBenefits?: string | null;
    preferredTone?: string | null;
    prohibitedTone?: string | null;
  } | null;
  messaging: { coreMessage?: string | null; tagline?: string | null } | null;
  audiences: Array<{ id: string; name: string; description: string | null }>;
  personas: Array<{ id: string; name: string; summary: string | null }>;
  offers: Array<{ id: string; name: string; description: string | null }>;
  competitors: Array<{ id: string; name: string; notes: string | null }>;
  complianceRules: Array<{ ruleType: string; ruleText: string }>;
}): ResolvedBrandContext {
  const prohibitedClaims = input.complianceRules
    .filter((rule) => rule.ruleType === "PROHIBITED_CLAIM")
    .map((rule) => rule.ruleText);
  const mandatoryDisclosures = input.complianceRules
    .filter((rule) => rule.ruleType === "MANDATORY_DISCLOSURE")
    .map((rule) => rule.ruleText);
  const prohibitedVocabulary = input.complianceRules
    .filter((rule) => rule.ruleType === "PROHIBITED_VOCABULARY")
    .map((rule) => rule.ruleText);

  return {
    brandName: input.brandName,
    shortDescription: input.profile?.shortDescription ?? null,
    valueProposition: input.profile?.valueProposition ?? null,
    mission: input.profile?.mission ?? null,
    targetAudience: input.profile?.targetAudience ?? null,
    keyBenefits: input.profile?.keyBenefits ?? null,
    preferredTone: input.profile?.preferredTone ?? null,
    prohibitedTone: input.profile?.prohibitedTone ?? null,
    coreMessage: input.messaging?.coreMessage ?? null,
    tagline: input.messaging?.tagline ?? null,
    audiences: input.audiences,
    personas: input.personas,
    offers: input.offers,
    competitors: input.competitors,
    prohibitedClaims,
    mandatoryDisclosures,
    prohibitedVocabulary,
  };
}
