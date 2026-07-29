import type { BrandKnowledgeSnapshot } from "@/lib/brand-knowledge/readiness";

export type BrandContextPayload = {
  brandName: string;
  identity: {
    description?: string | null;
    valueProposition?: string | null;
    mission?: string | null;
  };
  voice?: {
    preferredTone?: string | null;
    prohibitedVocabulary?: string[];
  };
  messaging?: {
    coreMessage?: string | null;
    prohibitedClaims?: string[];
  };
  compliance?: Array<{
    title: string;
    ruleText: string;
  }>;
};

export function buildBrandKnowledgeContext(snapshot: BrandKnowledgeSnapshot): BrandContextPayload {
  return {
    brandName: snapshot.brand.name,
    identity: {
      description: snapshot.brand.description,
      valueProposition: snapshot.profile?.valueProposition ?? null,
      mission: snapshot.profile?.mission ?? null,
    },
    voice: snapshot.voice
      ? {
          preferredTone: snapshot.voice.preferredTone,
          prohibitedVocabulary: snapshot.voice.prohibitedVocabulary,
        }
      : undefined,
    messaging: snapshot.messaging
      ? {
          coreMessage: snapshot.messaging.coreMessage,
          prohibitedClaims: snapshot.messaging.prohibitedClaims,
        }
      : undefined,
    compliance: snapshot.complianceRules
      .filter((rule) => !rule.archivedAt)
      .slice(0, 10)
      .map((rule) => ({
        title: rule.title,
        ruleText: rule.ruleText,
      })),
  };
}

export function serialiseBrandContext(
  context: BrandContextPayload | Record<string, unknown>,
): string {
  return JSON.stringify(context, null, 2);
}
