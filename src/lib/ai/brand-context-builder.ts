import type { BrandKnowledgeSnapshot } from "@/lib/brand-knowledge/readiness";
import type { MarketingObjective } from "@prisma/client";

export type BrandContextSelectionInput = {
  audienceId?: string;
  personaId?: string;
  offerId?: string;
  objectiveId?: string;
  contentPillar?: string;
  campaignObjective?: string;
};

export type UsedKnowledgeRecord = {
  type:
    | "profile"
    | "audience"
    | "persona"
    | "offer"
    | "messaging"
    | "voice"
    | "compliance"
    | "objective";
  id: string;
  label: string;
};

export type ControlledBrandContext = {
  brandName: string;
  identity: {
    description?: string | null;
    valueProposition?: string | null;
    mission?: string | null;
    shortDescription?: string | null;
  };
  audience?: {
    id: string;
    name: string;
    description?: string | null;
    painPoints: string[];
    motivations: string[];
    preferredChannels: string[];
  };
  persona?: {
    id: string;
    name: string;
    summary?: string | null;
    goals: string[];
    frustrations: string[];
  };
  offer?: {
    id: string;
    name: string;
    description?: string | null;
    benefits: string[];
    availabilityStatus: string;
  };
  messaging?: {
    coreMessage?: string | null;
    valuePropositions: string[];
    prohibitedClaims: string[];
    proofPoints: string[];
    ctaLibrary: string[];
  };
  voice?: {
    preferredTone?: string | null;
    prohibitedTone?: string | null;
    preferredVocabulary: string[];
    prohibitedVocabulary: string[];
  };
  compliance: Array<{
    id: string;
    title: string;
    ruleText: string;
    severity: string;
  }>;
  objective?: {
    id: string;
    type: string;
    description: string;
  };
  contentPillar?: string;
  campaignObjective?: string;
  usedRecords: UsedKnowledgeRecord[];
};

const MAX_COMPLIANCE_RULES = 8;
const MAX_PROOF_POINTS = 5;

export class BrandContextBuilder {
  build(
    snapshot: BrandKnowledgeSnapshot,
    selection: BrandContextSelectionInput,
    objective?: MarketingObjective | null,
  ): ControlledBrandContext {
    const usedRecords: UsedKnowledgeRecord[] = [];
    const context: ControlledBrandContext = {
      brandName: snapshot.brand.name,
      identity: {
        description: snapshot.brand.description,
        valueProposition: snapshot.profile?.valueProposition ?? null,
        mission: snapshot.profile?.mission ?? null,
        shortDescription: snapshot.profile?.shortDescription ?? null,
      },
      compliance: [],
      usedRecords,
    };

    if (snapshot.profile) {
      usedRecords.push({ type: "profile", id: snapshot.profile.id, label: "Brand profile" });
    }

    if (selection.audienceId) {
      const audience = snapshot.audiences.find((item) => item.id === selection.audienceId);
      if (audience) {
        context.audience = {
          id: audience.id,
          name: audience.name,
          description: audience.description,
          painPoints: audience.painPoints.slice(0, 5),
          motivations: audience.motivations.slice(0, 5),
          preferredChannels: audience.preferredChannels.slice(0, 6),
        };
        usedRecords.push({ type: "audience", id: audience.id, label: audience.name });
      }
    }

    if (selection.personaId) {
      const persona = snapshot.personas.find((item) => item.id === selection.personaId);
      if (persona) {
        context.persona = {
          id: persona.id,
          name: persona.name,
          summary: persona.description,
          goals: persona.goals.slice(0, 5),
          frustrations: persona.painPoints.slice(0, 5),
        };
        usedRecords.push({ type: "persona", id: persona.id, label: persona.name });
      }
    }

    if (selection.offerId) {
      const offer = snapshot.offers.find((item) => item.id === selection.offerId);
      if (offer) {
        context.offer = {
          id: offer.id,
          name: offer.name,
          description: offer.shortDescription,
          benefits: offer.benefits.slice(0, 5),
          availabilityStatus: offer.availabilityStatus,
        };
        usedRecords.push({ type: "offer", id: offer.id, label: offer.name });
      }
    }

    if (snapshot.messaging) {
      context.messaging = {
        coreMessage: snapshot.messaging.coreMessage,
        valuePropositions: snapshot.messaging.supportingMessages.slice(0, MAX_PROOF_POINTS),
        prohibitedClaims: snapshot.messaging.prohibitedClaims.slice(0, MAX_PROOF_POINTS),
        proofPoints: snapshot.messaging.proofPoints.slice(0, MAX_PROOF_POINTS),
        ctaLibrary: snapshot.messaging.ctaLibrary.slice(0, 8),
      };
      usedRecords.push({ type: "messaging", id: snapshot.messaging.id, label: "Brand messaging" });
    }

    if (snapshot.voice) {
      context.voice = {
        preferredTone: snapshot.voice.preferredTone,
        prohibitedTone: null,
        preferredVocabulary: snapshot.voice.vocabulary.slice(0, 10),
        prohibitedVocabulary: snapshot.voice.prohibitedVocabulary.slice(0, 10),
      };
      usedRecords.push({ type: "voice", id: snapshot.voice.id, label: "Voice rules" });
    }

    const complianceRules = snapshot.complianceRules
      .filter((rule) => !rule.archivedAt)
      .slice(0, MAX_COMPLIANCE_RULES);

    context.compliance = complianceRules.map((rule) => ({
      id: rule.id,
      title: rule.title,
      ruleText: rule.ruleText,
      severity: rule.severity,
    }));
    for (const rule of complianceRules) {
      usedRecords.push({ type: "compliance", id: rule.id, label: rule.title });
    }

    if (objective) {
      context.objective = {
        id: objective.id,
        type: objective.objectiveType,
        description: objective.description,
      };
      usedRecords.push({
        type: "objective",
        id: objective.id,
        label: objective.objectiveType,
      });
    }

    if (selection.contentPillar) {
      context.contentPillar = selection.contentPillar;
    }
    if (selection.campaignObjective) {
      context.campaignObjective = selection.campaignObjective;
    }

    return context;
  }

  serialise(context: ControlledBrandContext): string {
    return JSON.stringify(context, null, 2);
  }
}

export const brandContextBuilder = new BrandContextBuilder();
