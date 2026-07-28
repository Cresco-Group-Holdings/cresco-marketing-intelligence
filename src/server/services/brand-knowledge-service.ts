import {
  BrandAssetType,
  BrandComplianceRuleType,
  BrandComplianceSeverity,
  BrandOfferAvailabilityStatus,
  BrandReferenceType,
  Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";
import type { TenantContext } from "@/lib/tenancy/context";
import {
  BRAND_KNOWLEDGE_EXPORT_VERSION,
} from "@/lib/brand-knowledge/constants";
import {
  buildKnowledgeSummary,
  calculateKnowledgeReadiness,
  type BrandKnowledgeSnapshot,
} from "@/lib/brand-knowledge/readiness";
import { stripOwnershipFields, stripOwnershipFromCollection } from "@/lib/brand-knowledge/import-export";
import type {
  BrandAssetCreateInput,
  BrandAudienceCreateInput,
  BrandComplianceRuleCreateInput,
  BrandCompetitorCreateInput,
  BrandKnowledgeImportInput,
  BrandMessageUpsertInput,
  BrandOfferCreateInput,
  BrandPersonaCreateInput,
  BrandReferenceCreateInput,
  BrandVoiceRuleUpsertInput,
} from "@/lib/validation/brand-knowledge";
import { recordAuditEvent } from "@/server/services/audit-service";
import { brandService } from "@/server/services/workspace-service";

const ACTIVE_ONLY = { archivedAt: null } as const;

type BrandScope = {
  organisationId: string;
  projectId: string;
  brandId: string;
};

async function resolveBrandScope(
  brandId: string,
  organisationId: string,
  context: TenantContext,
): Promise<BrandScope> {
  const brand = await brandService.getById(brandId, organisationId, context);
  return {
    organisationId,
    projectId: brand.projectId,
    brandId,
  };
}

async function assertResourceBelongsToBrand(
  resourceBrandId: string,
  brandId: string,
  label: string,
): Promise<void> {
  if (resourceBrandId !== brandId) {
    throw new AppError("NOT_FOUND", `${label} was not found.`);
  }
}

function normaliseOptionalUrl(value: string | undefined): string | null {
  if (!value || value.trim().length === 0) return null;
  return value;
}

async function loadKnowledgeSnapshot(scope: BrandScope): Promise<BrandKnowledgeSnapshot> {
  const brandRecord = await prisma.brand.findFirstOrThrow({
    where: { id: scope.brandId, organisationId: scope.organisationId },
    select: {
      name: true,
      description: true,
      website: true,
      primaryDomain: true,
      logoUrl: true,
      faviconUrl: true,
      primaryColour: true,
      secondaryColour: true,
      accentColour: true,
      profile: true,
    },
  });

  const { profile, ...brand } = brandRecord;

  const [audiences, personas, offers, messaging, voice, competitors, assets, references, complianceRules] =
    await Promise.all([
      prisma.brandAudience.findMany({
        where: { brandId: scope.brandId, organisationId: scope.organisationId, ...ACTIVE_ONLY },
        orderBy: { createdAt: "asc" },
      }),
      prisma.brandPersona.findMany({
        where: { brandId: scope.brandId, organisationId: scope.organisationId, ...ACTIVE_ONLY },
        orderBy: { createdAt: "asc" },
      }),
      prisma.brandOffer.findMany({
        where: { brandId: scope.brandId, organisationId: scope.organisationId, ...ACTIVE_ONLY },
        orderBy: { createdAt: "asc" },
      }),
      prisma.brandMessage.findUnique({ where: { brandId: scope.brandId } }),
      prisma.brandVoiceRule.findUnique({ where: { brandId: scope.brandId } }),
      prisma.brandCompetitor.findMany({
        where: { brandId: scope.brandId, organisationId: scope.organisationId, ...ACTIVE_ONLY },
        orderBy: { createdAt: "asc" },
      }),
      prisma.brandAsset.findMany({
        where: { brandId: scope.brandId, organisationId: scope.organisationId, ...ACTIVE_ONLY },
        orderBy: { createdAt: "asc" },
      }),
      prisma.brandReference.findMany({
        where: { brandId: scope.brandId, organisationId: scope.organisationId, ...ACTIVE_ONLY },
        orderBy: { createdAt: "asc" },
      }),
      prisma.brandComplianceRule.findMany({
        where: { brandId: scope.brandId, organisationId: scope.organisationId, ...ACTIVE_ONLY },
        orderBy: { createdAt: "asc" },
      }),
    ]);

  return {
    brand,
    profile,
    audiences,
    personas,
    offers,
    messaging,
    voice,
    competitors,
    assets,
    references,
    complianceRules,
  };
}

function mapAudienceCreate(
  scope: BrandScope,
  input: BrandAudienceCreateInput,
): Prisma.BrandAudienceCreateInput {
  return {
    organisation: { connect: { id: scope.organisationId } },
    project: { connect: { id: scope.projectId } },
    brand: { connect: { id: scope.brandId } },
    name: input.name,
    description: input.description || null,
    countries: input.countries ?? [],
    industries: input.industries ?? [],
    organisationType: input.organisationType || null,
    companySize: input.companySize || null,
    jobRoles: input.jobRoles ?? [],
    painPoints: input.painPoints ?? [],
    motivations: input.motivations ?? [],
    objections: input.objections ?? [],
    buyingTriggers: input.buyingTriggers ?? [],
    preferredChannels: input.preferredChannels ?? [],
  };
}

function mapPersonaCreate(scope: BrandScope, input: BrandPersonaCreateInput): Prisma.BrandPersonaCreateInput {
  return {
    organisation: { connect: { id: scope.organisationId } },
    project: { connect: { id: scope.projectId } },
    brand: { connect: { id: scope.brandId } },
    name: input.name,
    description: input.description || null,
    roleTitle: input.roleTitle || null,
    goals: input.goals ?? [],
    painPoints: input.painPoints ?? [],
    motivations: input.motivations ?? [],
    objections: input.objections ?? [],
    buyingTriggers: input.buyingTriggers ?? [],
    preferredChannels: input.preferredChannels ?? [],
    notes: input.notes || null,
  };
}

function mapOfferCreate(scope: BrandScope, input: BrandOfferCreateInput): Prisma.BrandOfferCreateInput {
  return {
    organisation: { connect: { id: scope.organisationId } },
    project: { connect: { id: scope.projectId } },
    brand: { connect: { id: scope.brandId } },
    name: input.name,
    shortDescription: input.shortDescription || null,
    features: input.features ?? [],
    benefits: input.benefits ?? [],
    priceDescription: input.priceDescription || null,
    trialAvailable: input.trialAvailable ?? false,
    primaryCta: input.primaryCta || null,
    landingPageUrl: normaliseOptionalUrl(input.landingPageUrl),
    eligibilityRestrictions: input.eligibilityRestrictions || null,
    availabilityStatus: (input.availabilityStatus as BrandOfferAvailabilityStatus | undefined) ?? "AVAILABLE",
  };
}

function mapCompetitorCreate(
  scope: BrandScope,
  input: BrandCompetitorCreateInput,
): Prisma.BrandCompetitorCreateInput {
  return {
    organisation: { connect: { id: scope.organisationId } },
    project: { connect: { id: scope.projectId } },
    brand: { connect: { id: scope.brandId } },
    name: input.name,
    website: normaliseOptionalUrl(input.website),
    description: input.description || null,
    strengths: input.strengths ?? [],
    weaknesses: input.weaknesses ?? [],
    positioning: input.positioning || null,
    notes: input.notes || null,
  };
}

function mapAssetCreate(scope: BrandScope, input: BrandAssetCreateInput): Prisma.BrandAssetCreateInput {
  return {
    organisation: { connect: { id: scope.organisationId } },
    project: { connect: { id: scope.projectId } },
    brand: { connect: { id: scope.brandId } },
    assetType: input.assetType as BrandAssetType,
    name: input.name,
    description: input.description || null,
    fileUrl: normaliseOptionalUrl(input.fileUrl),
    mimeType: input.mimeType || null,
    metadata: (input.metadata ?? Prisma.JsonNull) as Prisma.InputJsonValue,
  };
}

function mapReferenceCreate(
  scope: BrandScope,
  input: BrandReferenceCreateInput,
): Prisma.BrandReferenceCreateInput {
  return {
    organisation: { connect: { id: scope.organisationId } },
    project: { connect: { id: scope.projectId } },
    brand: { connect: { id: scope.brandId } },
    referenceType: (input.referenceType as BrandReferenceType | undefined) ?? "OTHER",
    title: input.title,
    url: normaliseOptionalUrl(input.url),
    description: input.description || null,
    notes: input.notes || null,
  };
}

function mapComplianceCreate(
  scope: BrandScope,
  input: BrandComplianceRuleCreateInput,
): Prisma.BrandComplianceRuleCreateInput {
  return {
    organisation: { connect: { id: scope.organisationId } },
    project: { connect: { id: scope.projectId } },
    brand: { connect: { id: scope.brandId } },
    ruleType: input.ruleType as BrandComplianceRuleType,
    title: input.title,
    description: input.description || null,
    ruleText: input.ruleText,
    severity: (input.severity as BrandComplianceSeverity | undefined) ?? "WARNING",
    appliesTo: input.appliesTo ?? [],
  };
}

function mapMessageUpsert(scope: BrandScope, input: BrandMessageUpsertInput): Prisma.BrandMessageCreateInput {
  return {
    organisation: { connect: { id: scope.organisationId } },
    project: { connect: { id: scope.projectId } },
    brand: { connect: { id: scope.brandId } },
    elevatorPitch: input.elevatorPitch || null,
    coreMessage: input.coreMessage || null,
    supportingMessages: input.supportingMessages ?? [],
    proofPoints: input.proofPoints ?? [],
    differentiators: input.differentiators ?? [],
    objectionResponses: (input.objectionResponses ?? Prisma.JsonNull) as Prisma.InputJsonValue,
    ctaLibrary: input.ctaLibrary ?? [],
    prohibitedClaims: input.prohibitedClaims ?? [],
  };
}

function mapVoiceUpsert(scope: BrandScope, input: BrandVoiceRuleUpsertInput): Prisma.BrandVoiceRuleCreateInput {
  return {
    organisation: { connect: { id: scope.organisationId } },
    project: { connect: { id: scope.projectId } },
    brand: { connect: { id: scope.brandId } },
    preferredTone: input.preferredTone || null,
    vocabulary: input.vocabulary ?? [],
    prohibitedVocabulary: input.prohibitedVocabulary ?? [],
    sentenceStyle: input.sentenceStyle || null,
    emojiPolicy: input.emojiPolicy || null,
    humourPolicy: input.humourPolicy || null,
    preferredSpelling: input.preferredSpelling || null,
    languageVariants: input.languageVariants ?? [],
    approvedExamples: input.approvedExamples ?? [],
    unacceptableExamples: input.unacceptableExamples ?? [],
  };
}

async function auditKnowledgeChange(
  scope: BrandScope,
  context: TenantContext,
  action: string,
  resourceType: string,
  resourceId: string,
  requestId?: string,
): Promise<void> {
  await recordAuditEvent({
    organisationId: scope.organisationId,
    projectId: scope.projectId,
    actorUserId: context.userProfileId,
    action,
    resourceType,
    resourceId,
    requestId,
  });
}

export const brandKnowledgeService = {
  async getSnapshot(brandId: string, organisationId: string, context: TenantContext) {
    const scope = await resolveBrandScope(brandId, organisationId, context);
    return loadKnowledgeSnapshot(scope);
  },

  async getReadiness(brandId: string, organisationId: string, context: TenantContext) {
    const snapshot = await this.getSnapshot(brandId, organisationId, context);
    return calculateKnowledgeReadiness(snapshot);
  },

  async getSummary(brandId: string, organisationId: string, context: TenantContext) {
    const snapshot = await this.getSnapshot(brandId, organisationId, context);
    const readiness = calculateKnowledgeReadiness(snapshot);
    return {
      readiness,
      summary: buildKnowledgeSummary(snapshot, readiness),
    };
  },

  async exportKnowledge(brandId: string, organisationId: string, context: TenantContext) {
    const snapshot = await this.getSnapshot(brandId, organisationId, context);
    return {
      version: BRAND_KNOWLEDGE_EXPORT_VERSION,
      exportedAt: new Date().toISOString(),
      brand: {
        name: snapshot.brand.name,
        description: snapshot.brand.description,
        website: snapshot.brand.website,
        primaryDomain: snapshot.brand.primaryDomain,
        logoUrl: snapshot.brand.logoUrl,
        faviconUrl: snapshot.brand.faviconUrl,
        primaryColour: snapshot.brand.primaryColour,
        secondaryColour: snapshot.brand.secondaryColour,
        accentColour: snapshot.brand.accentColour,
      },
      profile: snapshot.profile
        ? stripOwnershipFields(snapshot.profile as unknown as Record<string, unknown>)
        : null,
      audiences: stripOwnershipFromCollection(snapshot.audiences as unknown as Record<string, unknown>[]),
      personas: stripOwnershipFromCollection(snapshot.personas as unknown as Record<string, unknown>[]),
      offers: stripOwnershipFromCollection(snapshot.offers as unknown as Record<string, unknown>[]),
      messaging: snapshot.messaging
        ? stripOwnershipFields(snapshot.messaging as unknown as Record<string, unknown>)
        : null,
      voice: snapshot.voice
        ? stripOwnershipFields(snapshot.voice as unknown as Record<string, unknown>)
        : null,
      competitors: stripOwnershipFromCollection(snapshot.competitors as unknown as Record<string, unknown>[]),
      assets: stripOwnershipFromCollection(snapshot.assets as unknown as Record<string, unknown>[]),
      references: stripOwnershipFromCollection(snapshot.references as unknown as Record<string, unknown>[]),
      complianceRules: stripOwnershipFromCollection(
        snapshot.complianceRules as unknown as Record<string, unknown>[],
      ),
    };
  },

  async importKnowledge(
    brandId: string,
    organisationId: string,
    input: BrandKnowledgeImportInput,
    context: TenantContext,
    requestId?: string,
  ) {
    const scope = await resolveBrandScope(brandId, organisationId, context);

    await prisma.$transaction(async (tx) => {
      if (input.audiences?.length) {
        for (const audience of input.audiences) {
          await tx.brandAudience.create({
            data: mapAudienceCreate(scope, stripOwnershipFields(audience)),
          });
        }
      }

      if (input.personas?.length) {
        for (const persona of input.personas) {
          await tx.brandPersona.create({
            data: mapPersonaCreate(scope, stripOwnershipFields(persona)),
          });
        }
      }

      if (input.offers?.length) {
        for (const offer of input.offers) {
          await tx.brandOffer.create({
            data: mapOfferCreate(scope, stripOwnershipFields(offer)),
          });
        }
      }

      if (input.messaging) {
        const messagingData = mapMessageUpsert(scope, stripOwnershipFields(input.messaging));
        await tx.brandMessage.upsert({
          where: { brandId: scope.brandId },
          update: {
            elevatorPitch: messagingData.elevatorPitch,
            coreMessage: messagingData.coreMessage,
            supportingMessages: messagingData.supportingMessages,
            proofPoints: messagingData.proofPoints,
            differentiators: messagingData.differentiators,
            objectionResponses: messagingData.objectionResponses,
            ctaLibrary: messagingData.ctaLibrary,
            prohibitedClaims: messagingData.prohibitedClaims,
          },
          create: messagingData,
        });
      }

      if (input.voice) {
        const voiceData = mapVoiceUpsert(scope, stripOwnershipFields(input.voice));
        await tx.brandVoiceRule.upsert({
          where: { brandId: scope.brandId },
          update: {
            preferredTone: voiceData.preferredTone,
            vocabulary: voiceData.vocabulary,
            prohibitedVocabulary: voiceData.prohibitedVocabulary,
            sentenceStyle: voiceData.sentenceStyle,
            emojiPolicy: voiceData.emojiPolicy,
            humourPolicy: voiceData.humourPolicy,
            preferredSpelling: voiceData.preferredSpelling,
            languageVariants: voiceData.languageVariants,
            approvedExamples: voiceData.approvedExamples,
            unacceptableExamples: voiceData.unacceptableExamples,
          },
          create: voiceData,
        });
      }

      if (input.competitors?.length) {
        for (const competitor of input.competitors) {
          await tx.brandCompetitor.create({
            data: mapCompetitorCreate(scope, stripOwnershipFields(competitor)),
          });
        }
      }

      if (input.assets?.length) {
        for (const asset of input.assets) {
          await tx.brandAsset.create({
            data: mapAssetCreate(scope, stripOwnershipFields(asset)),
          });
        }
      }

      if (input.references?.length) {
        for (const reference of input.references) {
          await tx.brandReference.create({
            data: mapReferenceCreate(scope, stripOwnershipFields(reference)),
          });
        }
      }

      if (input.complianceRules?.length) {
        for (const rule of input.complianceRules) {
          await tx.brandComplianceRule.create({
            data: mapComplianceCreate(scope, stripOwnershipFields(rule)),
          });
        }
      }
    });

    await auditKnowledgeChange(
      scope,
      context,
      "brandKnowledge.imported",
      "brandKnowledge",
      scope.brandId,
      requestId,
    );

    return this.getSnapshot(brandId, organisationId, context);
  },

  audiences: {
    async list(brandId: string, organisationId: string, context: TenantContext) {
      const scope = await resolveBrandScope(brandId, organisationId, context);
      return prisma.brandAudience.findMany({
        where: { brandId: scope.brandId, organisationId: scope.organisationId, ...ACTIVE_ONLY },
        orderBy: { createdAt: "asc" },
      });
    },

    async create(
      brandId: string,
      organisationId: string,
      input: BrandAudienceCreateInput,
      context: TenantContext,
      requestId?: string,
    ) {
      const scope = await resolveBrandScope(brandId, organisationId, context);
      const audience = await prisma.brandAudience.create({
        data: mapAudienceCreate(scope, input),
      });
      await auditKnowledgeChange(scope, context, "brandAudience.created", "brandAudience", audience.id, requestId);
      return audience;
    },

    async update(
      brandId: string,
      organisationId: string,
      audienceId: string,
      input: Partial<BrandAudienceCreateInput>,
      context: TenantContext,
      requestId?: string,
    ) {
      const scope = await resolveBrandScope(brandId, organisationId, context);
      const existing = await prisma.brandAudience.findFirst({
        where: { id: audienceId, organisationId: scope.organisationId, ...ACTIVE_ONLY },
      });
      if (!existing) throw new AppError("NOT_FOUND", "Audience was not found.");
      await assertResourceBelongsToBrand(existing.brandId, scope.brandId, "Audience");

      const audience = await prisma.brandAudience.update({
        where: { id: audienceId },
        data: {
          name: input.name,
          description: input.description,
          countries: input.countries,
          industries: input.industries,
          organisationType: input.organisationType,
          companySize: input.companySize,
          jobRoles: input.jobRoles,
          painPoints: input.painPoints,
          motivations: input.motivations,
          objections: input.objections,
          buyingTriggers: input.buyingTriggers,
          preferredChannels: input.preferredChannels,
        },
      });
      await auditKnowledgeChange(scope, context, "brandAudience.updated", "brandAudience", audience.id, requestId);
      return audience;
    },

    async archive(
      brandId: string,
      organisationId: string,
      audienceId: string,
      context: TenantContext,
      requestId?: string,
    ) {
      const scope = await resolveBrandScope(brandId, organisationId, context);
      const existing = await prisma.brandAudience.findFirst({
        where: { id: audienceId, organisationId: scope.organisationId, ...ACTIVE_ONLY },
      });
      if (!existing) throw new AppError("NOT_FOUND", "Audience was not found.");
      await assertResourceBelongsToBrand(existing.brandId, scope.brandId, "Audience");

      const audience = await prisma.brandAudience.update({
        where: { id: audienceId },
        data: { archivedAt: new Date() },
      });
      await auditKnowledgeChange(scope, context, "brandAudience.archived", "brandAudience", audience.id, requestId);
      return audience;
    },
  },

  personas: {
    async list(brandId: string, organisationId: string, context: TenantContext) {
      const scope = await resolveBrandScope(brandId, organisationId, context);
      return prisma.brandPersona.findMany({
        where: { brandId: scope.brandId, organisationId: scope.organisationId, ...ACTIVE_ONLY },
        orderBy: { createdAt: "asc" },
      });
    },

    async create(
      brandId: string,
      organisationId: string,
      input: BrandPersonaCreateInput,
      context: TenantContext,
      requestId?: string,
    ) {
      const scope = await resolveBrandScope(brandId, organisationId, context);
      const persona = await prisma.brandPersona.create({ data: mapPersonaCreate(scope, input) });
      await auditKnowledgeChange(scope, context, "brandPersona.created", "brandPersona", persona.id, requestId);
      return persona;
    },

    async update(
      brandId: string,
      organisationId: string,
      personaId: string,
      input: Partial<BrandPersonaCreateInput>,
      context: TenantContext,
      requestId?: string,
    ) {
      const scope = await resolveBrandScope(brandId, organisationId, context);
      const existing = await prisma.brandPersona.findFirst({
        where: { id: personaId, organisationId: scope.organisationId, ...ACTIVE_ONLY },
      });
      if (!existing) throw new AppError("NOT_FOUND", "Persona was not found.");
      await assertResourceBelongsToBrand(existing.brandId, scope.brandId, "Persona");

      const persona = await prisma.brandPersona.update({
        where: { id: personaId },
        data: input,
      });
      await auditKnowledgeChange(scope, context, "brandPersona.updated", "brandPersona", persona.id, requestId);
      return persona;
    },

    async archive(
      brandId: string,
      organisationId: string,
      personaId: string,
      context: TenantContext,
      requestId?: string,
    ) {
      const scope = await resolveBrandScope(brandId, organisationId, context);
      const existing = await prisma.brandPersona.findFirst({
        where: { id: personaId, organisationId: scope.organisationId, ...ACTIVE_ONLY },
      });
      if (!existing) throw new AppError("NOT_FOUND", "Persona was not found.");
      await assertResourceBelongsToBrand(existing.brandId, scope.brandId, "Persona");

      const persona = await prisma.brandPersona.update({
        where: { id: personaId },
        data: { archivedAt: new Date() },
      });
      await auditKnowledgeChange(scope, context, "brandPersona.archived", "brandPersona", persona.id, requestId);
      return persona;
    },
  },

  offers: {
    async list(brandId: string, organisationId: string, context: TenantContext) {
      const scope = await resolveBrandScope(brandId, organisationId, context);
      return prisma.brandOffer.findMany({
        where: { brandId: scope.brandId, organisationId: scope.organisationId, ...ACTIVE_ONLY },
        orderBy: { createdAt: "asc" },
      });
    },

    async create(
      brandId: string,
      organisationId: string,
      input: BrandOfferCreateInput,
      context: TenantContext,
      requestId?: string,
    ) {
      const scope = await resolveBrandScope(brandId, organisationId, context);
      const offer = await prisma.brandOffer.create({ data: mapOfferCreate(scope, input) });
      await auditKnowledgeChange(scope, context, "brandOffer.created", "brandOffer", offer.id, requestId);
      return offer;
    },

    async update(
      brandId: string,
      organisationId: string,
      offerId: string,
      input: Partial<BrandOfferCreateInput>,
      context: TenantContext,
      requestId?: string,
    ) {
      const scope = await resolveBrandScope(brandId, organisationId, context);
      const existing = await prisma.brandOffer.findFirst({
        where: { id: offerId, organisationId: scope.organisationId, ...ACTIVE_ONLY },
      });
      if (!existing) throw new AppError("NOT_FOUND", "Offer was not found.");
      await assertResourceBelongsToBrand(existing.brandId, scope.brandId, "Offer");

      const offer = await prisma.brandOffer.update({
        where: { id: offerId },
        data: {
          ...input,
          landingPageUrl:
            input.landingPageUrl === undefined
              ? undefined
              : normaliseOptionalUrl(input.landingPageUrl),
        },
      });
      await auditKnowledgeChange(scope, context, "brandOffer.updated", "brandOffer", offer.id, requestId);
      return offer;
    },

    async archive(
      brandId: string,
      organisationId: string,
      offerId: string,
      context: TenantContext,
      requestId?: string,
    ) {
      const scope = await resolveBrandScope(brandId, organisationId, context);
      const existing = await prisma.brandOffer.findFirst({
        where: { id: offerId, organisationId: scope.organisationId, ...ACTIVE_ONLY },
      });
      if (!existing) throw new AppError("NOT_FOUND", "Offer was not found.");
      await assertResourceBelongsToBrand(existing.brandId, scope.brandId, "Offer");

      const offer = await prisma.brandOffer.update({
        where: { id: offerId },
        data: { archivedAt: new Date() },
      });
      await auditKnowledgeChange(scope, context, "brandOffer.archived", "brandOffer", offer.id, requestId);
      return offer;
    },
  },

  messaging: {
    async get(brandId: string, organisationId: string, context: TenantContext) {
      const scope = await resolveBrandScope(brandId, organisationId, context);
      return prisma.brandMessage.findUnique({ where: { brandId: scope.brandId } });
    },

    async upsert(
      brandId: string,
      organisationId: string,
      input: BrandMessageUpsertInput,
      context: TenantContext,
      requestId?: string,
    ) {
      const scope = await resolveBrandScope(brandId, organisationId, context);
      const data = mapMessageUpsert(scope, input);
      const messaging = await prisma.brandMessage.upsert({
        where: { brandId: scope.brandId },
        update: {
          elevatorPitch: data.elevatorPitch,
          coreMessage: data.coreMessage,
          supportingMessages: data.supportingMessages,
          proofPoints: data.proofPoints,
          differentiators: data.differentiators,
          objectionResponses: data.objectionResponses,
          ctaLibrary: data.ctaLibrary,
          prohibitedClaims: data.prohibitedClaims,
        },
        create: data,
      });
      await auditKnowledgeChange(scope, context, "brandMessage.updated", "brandMessage", messaging.id, requestId);
      return messaging;
    },
  },

  voice: {
    async get(brandId: string, organisationId: string, context: TenantContext) {
      const scope = await resolveBrandScope(brandId, organisationId, context);
      return prisma.brandVoiceRule.findUnique({ where: { brandId: scope.brandId } });
    },

    async upsert(
      brandId: string,
      organisationId: string,
      input: BrandVoiceRuleUpsertInput,
      context: TenantContext,
      requestId?: string,
    ) {
      const scope = await resolveBrandScope(brandId, organisationId, context);
      const data = mapVoiceUpsert(scope, input);
      const voice = await prisma.brandVoiceRule.upsert({
        where: { brandId: scope.brandId },
        update: {
          preferredTone: data.preferredTone,
          vocabulary: data.vocabulary,
          prohibitedVocabulary: data.prohibitedVocabulary,
          sentenceStyle: data.sentenceStyle,
          emojiPolicy: data.emojiPolicy,
          humourPolicy: data.humourPolicy,
          preferredSpelling: data.preferredSpelling,
          languageVariants: data.languageVariants,
          approvedExamples: data.approvedExamples,
          unacceptableExamples: data.unacceptableExamples,
        },
        create: data,
      });
      await auditKnowledgeChange(scope, context, "brandVoiceRule.updated", "brandVoiceRule", voice.id, requestId);
      return voice;
    },
  },

  competitors: {
    async list(brandId: string, organisationId: string, context: TenantContext) {
      const scope = await resolveBrandScope(brandId, organisationId, context);
      return prisma.brandCompetitor.findMany({
        where: { brandId: scope.brandId, organisationId: scope.organisationId, ...ACTIVE_ONLY },
        orderBy: { createdAt: "asc" },
      });
    },

    async create(
      brandId: string,
      organisationId: string,
      input: BrandCompetitorCreateInput,
      context: TenantContext,
      requestId?: string,
    ) {
      const scope = await resolveBrandScope(brandId, organisationId, context);
      const competitor = await prisma.brandCompetitor.create({ data: mapCompetitorCreate(scope, input) });
      await auditKnowledgeChange(scope, context, "brandCompetitor.created", "brandCompetitor", competitor.id, requestId);
      return competitor;
    },

    async update(
      brandId: string,
      organisationId: string,
      competitorId: string,
      input: Partial<BrandCompetitorCreateInput>,
      context: TenantContext,
      requestId?: string,
    ) {
      const scope = await resolveBrandScope(brandId, organisationId, context);
      const existing = await prisma.brandCompetitor.findFirst({
        where: { id: competitorId, organisationId: scope.organisationId, ...ACTIVE_ONLY },
      });
      if (!existing) throw new AppError("NOT_FOUND", "Competitor was not found.");
      await assertResourceBelongsToBrand(existing.brandId, scope.brandId, "Competitor");

      const competitor = await prisma.brandCompetitor.update({
        where: { id: competitorId },
        data: {
          ...input,
          website: input.website === undefined ? undefined : normaliseOptionalUrl(input.website),
        },
      });
      await auditKnowledgeChange(scope, context, "brandCompetitor.updated", "brandCompetitor", competitor.id, requestId);
      return competitor;
    },

    async archive(
      brandId: string,
      organisationId: string,
      competitorId: string,
      context: TenantContext,
      requestId?: string,
    ) {
      const scope = await resolveBrandScope(brandId, organisationId, context);
      const existing = await prisma.brandCompetitor.findFirst({
        where: { id: competitorId, organisationId: scope.organisationId, ...ACTIVE_ONLY },
      });
      if (!existing) throw new AppError("NOT_FOUND", "Competitor was not found.");
      await assertResourceBelongsToBrand(existing.brandId, scope.brandId, "Competitor");

      const competitor = await prisma.brandCompetitor.update({
        where: { id: competitorId },
        data: { archivedAt: new Date() },
      });
      await auditKnowledgeChange(scope, context, "brandCompetitor.archived", "brandCompetitor", competitor.id, requestId);
      return competitor;
    },
  },

  assets: {
    async list(brandId: string, organisationId: string, context: TenantContext) {
      const scope = await resolveBrandScope(brandId, organisationId, context);
      return prisma.brandAsset.findMany({
        where: { brandId: scope.brandId, organisationId: scope.organisationId, ...ACTIVE_ONLY },
        orderBy: { createdAt: "asc" },
      });
    },

    async create(
      brandId: string,
      organisationId: string,
      input: BrandAssetCreateInput,
      context: TenantContext,
      requestId?: string,
    ) {
      const scope = await resolveBrandScope(brandId, organisationId, context);
      const asset = await prisma.brandAsset.create({ data: mapAssetCreate(scope, input) });
      await auditKnowledgeChange(scope, context, "brandAsset.created", "brandAsset", asset.id, requestId);
      return asset;
    },

    async update(
      brandId: string,
      organisationId: string,
      assetId: string,
      input: Partial<BrandAssetCreateInput>,
      context: TenantContext,
      requestId?: string,
    ) {
      const scope = await resolveBrandScope(brandId, organisationId, context);
      const existing = await prisma.brandAsset.findFirst({
        where: { id: assetId, organisationId: scope.organisationId, ...ACTIVE_ONLY },
      });
      if (!existing) throw new AppError("NOT_FOUND", "Asset was not found.");
      await assertResourceBelongsToBrand(existing.brandId, scope.brandId, "Asset");

      const asset = await prisma.brandAsset.update({
        where: { id: assetId },
        data: {
          assetType: input.assetType,
          name: input.name,
          description: input.description,
          mimeType: input.mimeType,
          fileUrl: input.fileUrl === undefined ? undefined : normaliseOptionalUrl(input.fileUrl),
          metadata:
            input.metadata === undefined
              ? undefined
              : ((input.metadata ?? Prisma.JsonNull) as Prisma.InputJsonValue),
        },
      });
      await auditKnowledgeChange(scope, context, "brandAsset.updated", "brandAsset", asset.id, requestId);
      return asset;
    },

    async archive(
      brandId: string,
      organisationId: string,
      assetId: string,
      context: TenantContext,
      requestId?: string,
    ) {
      const scope = await resolveBrandScope(brandId, organisationId, context);
      const existing = await prisma.brandAsset.findFirst({
        where: { id: assetId, organisationId: scope.organisationId, ...ACTIVE_ONLY },
      });
      if (!existing) throw new AppError("NOT_FOUND", "Asset was not found.");
      await assertResourceBelongsToBrand(existing.brandId, scope.brandId, "Asset");

      const asset = await prisma.brandAsset.update({
        where: { id: assetId },
        data: { archivedAt: new Date() },
      });
      await auditKnowledgeChange(scope, context, "brandAsset.archived", "brandAsset", asset.id, requestId);
      return asset;
    },
  },

  references: {
    async list(brandId: string, organisationId: string, context: TenantContext) {
      const scope = await resolveBrandScope(brandId, organisationId, context);
      return prisma.brandReference.findMany({
        where: { brandId: scope.brandId, organisationId: scope.organisationId, ...ACTIVE_ONLY },
        orderBy: { createdAt: "asc" },
      });
    },

    async create(
      brandId: string,
      organisationId: string,
      input: BrandReferenceCreateInput,
      context: TenantContext,
      requestId?: string,
    ) {
      const scope = await resolveBrandScope(brandId, organisationId, context);
      const reference = await prisma.brandReference.create({ data: mapReferenceCreate(scope, input) });
      await auditKnowledgeChange(scope, context, "brandReference.created", "brandReference", reference.id, requestId);
      return reference;
    },

    async update(
      brandId: string,
      organisationId: string,
      referenceId: string,
      input: Partial<BrandReferenceCreateInput>,
      context: TenantContext,
      requestId?: string,
    ) {
      const scope = await resolveBrandScope(brandId, organisationId, context);
      const existing = await prisma.brandReference.findFirst({
        where: { id: referenceId, organisationId: scope.organisationId, ...ACTIVE_ONLY },
      });
      if (!existing) throw new AppError("NOT_FOUND", "Reference was not found.");
      await assertResourceBelongsToBrand(existing.brandId, scope.brandId, "Reference");

      const reference = await prisma.brandReference.update({
        where: { id: referenceId },
        data: {
          ...input,
          url: input.url === undefined ? undefined : normaliseOptionalUrl(input.url),
        },
      });
      await auditKnowledgeChange(scope, context, "brandReference.updated", "brandReference", reference.id, requestId);
      return reference;
    },

    async archive(
      brandId: string,
      organisationId: string,
      referenceId: string,
      context: TenantContext,
      requestId?: string,
    ) {
      const scope = await resolveBrandScope(brandId, organisationId, context);
      const existing = await prisma.brandReference.findFirst({
        where: { id: referenceId, organisationId: scope.organisationId, ...ACTIVE_ONLY },
      });
      if (!existing) throw new AppError("NOT_FOUND", "Reference was not found.");
      await assertResourceBelongsToBrand(existing.brandId, scope.brandId, "Reference");

      const reference = await prisma.brandReference.update({
        where: { id: referenceId },
        data: { archivedAt: new Date() },
      });
      await auditKnowledgeChange(scope, context, "brandReference.archived", "brandReference", reference.id, requestId);
      return reference;
    },
  },

  complianceRules: {
    async list(brandId: string, organisationId: string, context: TenantContext) {
      const scope = await resolveBrandScope(brandId, organisationId, context);
      return prisma.brandComplianceRule.findMany({
        where: { brandId: scope.brandId, organisationId: scope.organisationId, ...ACTIVE_ONLY },
        orderBy: { createdAt: "asc" },
      });
    },

    async create(
      brandId: string,
      organisationId: string,
      input: BrandComplianceRuleCreateInput,
      context: TenantContext,
      requestId?: string,
    ) {
      const scope = await resolveBrandScope(brandId, organisationId, context);
      const rule = await prisma.brandComplianceRule.create({ data: mapComplianceCreate(scope, input) });
      await auditKnowledgeChange(scope, context, "brandComplianceRule.created", "brandComplianceRule", rule.id, requestId);
      return rule;
    },

    async update(
      brandId: string,
      organisationId: string,
      ruleId: string,
      input: Partial<BrandComplianceRuleCreateInput>,
      context: TenantContext,
      requestId?: string,
    ) {
      const scope = await resolveBrandScope(brandId, organisationId, context);
      const existing = await prisma.brandComplianceRule.findFirst({
        where: { id: ruleId, organisationId: scope.organisationId, ...ACTIVE_ONLY },
      });
      if (!existing) throw new AppError("NOT_FOUND", "Compliance rule was not found.");
      await assertResourceBelongsToBrand(existing.brandId, scope.brandId, "Compliance rule");

      const rule = await prisma.brandComplianceRule.update({
        where: { id: ruleId },
        data: input,
      });
      await auditKnowledgeChange(scope, context, "brandComplianceRule.updated", "brandComplianceRule", rule.id, requestId);
      return rule;
    },

    async archive(
      brandId: string,
      organisationId: string,
      ruleId: string,
      context: TenantContext,
      requestId?: string,
    ) {
      const scope = await resolveBrandScope(brandId, organisationId, context);
      const existing = await prisma.brandComplianceRule.findFirst({
        where: { id: ruleId, organisationId: scope.organisationId, ...ACTIVE_ONLY },
      });
      if (!existing) throw new AppError("NOT_FOUND", "Compliance rule was not found.");
      await assertResourceBelongsToBrand(existing.brandId, scope.brandId, "Compliance rule");

      const rule = await prisma.brandComplianceRule.update({
        where: { id: ruleId },
        data: { archivedAt: new Date() },
      });
      await auditKnowledgeChange(scope, context, "brandComplianceRule.archived", "brandComplianceRule", rule.id, requestId);
      return rule;
    },
  },
};
