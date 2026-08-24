import {
  ContentRevisionSource,
  ContentStatus,
  ContentStudioType,
  Prisma,
} from "@prisma/client";
import {
  contentIntelligenceBriefOutputSchema,
  contentIntelligenceMasterOutputSchema,
  type ContentIntelligenceBriefOutput,
  type ContentIntelligenceMasterOutput,
} from "@/lib/ai/content-output-schemas";
import { brandContextBuilder } from "@/lib/ai/brand-context-builder";
import {
  assertSourceModeAllowed,
  buildBriefGenerationPrompt,
  buildMasterGenerationPrompt,
  mapObjectiveValue,
  type BriefGenerationInput,
  type ResolvedGenerationContext,
  type ResolvedSourceEvidence,
} from "@/lib/content-intelligence/generation-context";
import { briefToStudioFields } from "@/lib/content-intelligence/brief";
import {
  buildProvenanceMetadata,
  parseContentIntelligenceProvenance,
  provenanceToBrief,
  type ContentIntelligenceProvenance,
} from "@/lib/content-intelligence/provenance";
import type { ContentBrief, MasterContent } from "@/lib/content-intelligence/types";
import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";
import type { TenantContext } from "@/lib/tenancy/context";
import type {
  ContentIntelligenceBriefGenerateInput,
  ContentIntelligenceBriefUpdateInput,
  ContentIntelligenceMasterGenerateInput,
  ContentIntelligenceMasterUpdateInput,
} from "@/lib/validation/content-intelligence";
import { aiRequestService } from "@/server/services/ai-request-service";
import { brandKnowledgeService } from "@/server/services/brand-knowledge-service";
import { contentStudioService } from "@/server/services/content-studio-service";
import { promptTemplateService } from "@/server/services/prompt-template-service";
import { brandService } from "@/server/services/workspace-service";

const BRIEF_GENERATION_ERROR =
  "We couldn't generate a valid content brief. Your context has been preserved.";
const MASTER_GENERATION_ERROR =
  "We couldn't generate valid master content. Your brief has been preserved.";

type BrandScope = {
  organisationId: string;
  projectId: string;
  brandId: string;
};

type GenerationSession = {
  contentId: string;
  brief: ContentBrief;
  master: MasterContent | null;
  provenance: ContentIntelligenceProvenance;
  complianceFindings: Awaited<
    ReturnType<typeof contentStudioService.runCompliance>
  >["findings"];
  status: ContentStatus;
  version: number;
};

async function resolveBrandScope(
  brandId: string,
  organisationId: string,
  context: TenantContext,
): Promise<BrandScope> {
  const brand = await brandService.getById(brandId, organisationId, context);
  return { organisationId, projectId: brand.projectId, brandId };
}

function mapProviderError(error: unknown, fallbackMessage: string): never {
  if (error instanceof AppError) {
    if (error.code === "AI_CONFIGURATION_REQUIRED") {
      throw new AppError(
        "AI_CONFIGURATION_REQUIRED",
        "AI content generation is not configured for this workspace.",
      );
    }
    if (error.code === "RATE_LIMITED") {
      throw new AppError("RATE_LIMITED", "AI generation is temporarily rate limited. Please retry.");
    }
    if (error.code === "VALIDATION_ERROR") {
      throw new AppError("VALIDATION_ERROR", fallbackMessage);
    }
    throw error;
  }
  throw new AppError("VALIDATION_ERROR", fallbackMessage);
}

function mapBriefOutput(
  output: ContentIntelligenceBriefOutput,
  context: ResolvedGenerationContext,
): ContentBrief {
  return {
    mode: context.mode,
    objective: mapObjectiveValue(output.objective) ?? context.objective,
    funnelStage: context.funnelStage,
    audienceId: context.audienceId,
    audienceLabel: output.audienceSummary,
    audiencePain: output.audiencePain ?? null,
    offerId: context.offerId,
    offerLabel: context.offerLabel,
    campaignId: context.campaignId,
    campaignLabel: context.campaignLabel,
    contentPillar: output.contentPillar ?? context.contentPillar,
    keyMessage: output.keyMessage,
    supportingMessages: output.supportingMessages,
    proofPoints: output.proofPoints,
    differentiators: output.differentiators,
    cta: output.cta,
    channelStrategy: output.channelStrategy,
    suggestedFormats: output.suggestedFormats,
    prohibitedClaims: context.prohibitedClaims,
    evidenceNotes: output.evidenceNotes ?? context.evidenceNotes,
    successMetric: output.successMetric ?? null,
    sourceOpportunityId: context.sourceOpportunityId,
    sourceContentId: context.sourceContentId,
  };
}

function mapMasterOutput(
  output: ContentIntelligenceMasterOutput,
  brief: ContentBrief,
  contentId: string,
  aiMeta: { aiRequestId: string; provider: string; model: string },
): MasterContent {
  return {
    id: contentId,
    briefId: contentId,
    title: output.title,
    summary: output.summary ?? null,
    hook: output.hook ?? null,
    body: output.body,
    keyPoints: output.keyPoints,
    cta: output.cta ?? brief.cta,
    contentPillar: output.contentPillar ?? brief.contentPillar ?? null,
    audienceLabel: brief.audienceLabel ?? null,
    offerLabel: brief.offerLabel ?? null,
    objective: brief.objective,
    campaignLabel: brief.campaignLabel ?? null,
    status: "draft",
    generationMetadata: {
      aiRequestId: aiMeta.aiRequestId,
      provider: aiMeta.provider,
      model: aiMeta.model,
      generatedAt: new Date().toISOString(),
      humanEdited: false,
    },
  };
}

async function resolveSourceEvidence(
  scope: BrandScope,
  input: BriefGenerationInput,
): Promise<ResolvedSourceEvidence | null> {
  if (input.mode === "winning_content" && input.sourceContentId) {
    const source = await prisma.contentItem.findFirst({
      where: {
        id: input.sourceContentId,
        organisationId: scope.organisationId,
        brandId: scope.brandId,
        archivedAt: null,
      },
      select: { id: true, title: true, contentPillar: true },
    });
    if (!source) return null;
    return {
      label: `Winning content: ${source.title}`,
      notes: [
        `Source content ID: ${source.id}`,
        source.contentPillar ? `Pillar: ${source.contentPillar}` : "Studio lifecycle performance signal",
      ],
    };
  }

  if (input.mode === "campaign" && input.campaignId) {
    const campaign = await prisma.campaign.findFirst({
      where: {
        id: input.campaignId,
        organisationId: scope.organisationId,
        brandId: scope.brandId,
        archivedAt: null,
      },
      select: { id: true, name: true, primaryObjective: true },
    });
    if (!campaign) return null;
    return {
      label: `Campaign: ${campaign.name}`,
      notes: [
        campaign.primaryObjective
          ? `Objective: ${campaign.primaryObjective}`
          : "Active campaign context",
      ],
    };
  }

  if (input.mode === "opportunity" && input.sourceOpportunityId) {
    const opportunity = await prisma.growthRecommendation.findFirst({
      where: {
        id: input.sourceOpportunityId,
        organisationId: scope.organisationId,
        brandId: scope.brandId,
      },
      select: { id: true, title: true, description: true },
    });
    if (!opportunity) return null;
    return {
      label: `Opportunity: ${opportunity.title}`,
      notes: [opportunity.description],
    };
  }

  if (input.mode === "competitor_signal" && input.competitorSignalId) {
    const signal = await prisma.seoCompetitorPage.findFirst({
      where: {
        id: input.competitorSignalId,
        competitor: { brandId: scope.brandId, organisationId: scope.organisationId },
      },
      select: { id: true, url: true, title: true },
    });
    if (!signal) return null;
    return {
      label: "Competitor structure signal",
      notes: [
        signal.title ? `Observed page: ${signal.title}` : `Observed URL: ${signal.url}`,
        "Public structure observation only — do not reproduce competitor copy.",
      ],
    };
  }

  return null;
}

async function resolveGenerationContext(
  scope: BrandScope,
  input: BriefGenerationInput,
  tenant: TenantContext,
): Promise<ResolvedGenerationContext> {
  const snapshot = await brandKnowledgeService.getSnapshot(
    scope.brandId,
    scope.organisationId,
    tenant,
  );

  let campaignLabel: string | null = null;
  const campaignId: string | null = input.campaignId ?? null;
  if (input.campaignId) {
    const campaign = await prisma.campaign.findFirst({
      where: {
        id: input.campaignId,
        organisationId: scope.organisationId,
        brandId: scope.brandId,
        archivedAt: null,
      },
    });
    if (!campaign) {
      throw new AppError("NOT_FOUND", "Campaign was not found for this brand.");
    }
    campaignLabel = campaign.name;
  }

  const brandContext = brandContextBuilder.build(snapshot, {
    audienceId: input.audienceId ?? undefined,
    offerId: input.offerId ?? undefined,
    contentPillar: input.contentPillar ?? undefined,
  });

  if (input.audienceId && !brandContext.audience) {
    throw new AppError("NOT_FOUND", "Audience was not found for this brand.");
  }
  if (input.offerId && !brandContext.offer) {
    throw new AppError("NOT_FOUND", "Offer was not found for this brand.");
  }

  const sourceEvidence = await resolveSourceEvidence(scope, input);
  assertSourceModeAllowed(input.mode, sourceEvidence);

  const prohibitedClaims = [
    ...(brandContext.messaging?.prohibitedClaims ?? []),
    ...snapshot.complianceRules
      .filter((rule) => !rule.archivedAt && rule.ruleType === "PROHIBITED_CLAIM")
      .map((rule) => rule.ruleText),
  ];

  return {
    mode: input.mode,
    objective: input.objective ?? "education",
    funnelStage: input.funnelStage ?? null,
    audienceId: brandContext.audience?.id ?? null,
    audienceLabel: brandContext.audience?.name ?? null,
    offerId: brandContext.offer?.id ?? null,
    offerLabel: brandContext.offer?.name ?? null,
    campaignId,
    campaignLabel,
    contentPillar: input.contentPillar ?? null,
    sourceContentId: input.sourceContentId ?? null,
    sourceOpportunityId: input.sourceOpportunityId ?? null,
    evidenceNotes: sourceEvidence?.notes ?? [],
    prohibitedClaims,
    brandContext,
  };
}

async function getProvenanceForContent(contentId: string, scope: BrandScope) {
  const provenance = await prisma.contentProvenance.findFirst({
    where: {
      contentItemId: contentId,
      organisationId: scope.organisationId,
      brandId: scope.brandId,
    },
  });
  if (!provenance) {
    throw new AppError("NOT_FOUND", "Content intelligence session was not found.");
  }
  const parsed = parseContentIntelligenceProvenance(provenance.metadata);
  if (!parsed) {
    throw new AppError("VALIDATION_ERROR", "Stored brief metadata is invalid.");
  }
  return { provenance, parsed };
}

function sessionFromItem(
  item: {
    id: string;
    status: ContentStatus;
    version: number;
    title: string;
    contentBody: string | null;
    primaryCTA: string | null;
    contentPillar: string | null;
    audienceSummary: string | null;
    studioObjective: string | null;
    campaignName: string | null;
    complianceChecks: Array<{
      checkType: string;
      result: string;
      message: string;
      blocking: boolean;
    }>;
  },
  provenance: ContentIntelligenceProvenance,
): GenerationSession {
  const brief = provenanceToBrief(provenance);
  const hasMaster = Boolean(item.contentBody?.trim());
  const master: MasterContent | null = hasMaster
    ? {
        id: item.id,
        briefId: provenance.briefId,
        title: item.title,
        summary: provenance.structuredMaster?.summary ?? null,
        hook: provenance.structuredMaster?.hook ?? null,
        body: item.contentBody ?? "",
        keyPoints: provenance.structuredMaster?.keyPoints ?? [],
        cta: item.primaryCTA,
        contentPillar: item.contentPillar,
        audienceLabel: item.audienceSummary,
        objective: brief.objective,
        campaignLabel: item.campaignName,
        status:
          item.status === "APPROVED"
            ? "approved"
            : item.status === "IN_REVIEW"
              ? "review"
              : item.status === "PUBLISHED"
                ? "published"
                : "draft",
        generationMetadata: provenance.masterGeneration
          ? {
              aiRequestId: provenance.masterGeneration.aiRequestId,
              provider: provenance.masterGeneration.provider,
              model: provenance.masterGeneration.model,
              generatedAt: provenance.masterGeneration.generatedAt,
              humanEdited: provenance.masterGeneration.humanEdited,
            }
          : undefined,
      }
    : null;

  return {
    contentId: item.id,
    brief,
    master,
    provenance,
    complianceFindings: item.complianceChecks.map((check) => ({
      checkType: check.checkType as never,
      result: check.result as never,
      message: check.message,
      blocking: check.blocking,
    })),
    status: item.status,
    version: item.version,
  };
}

async function assertIdempotency(
  scope: BrandScope,
  contentId: string | undefined,
  operation: "brief" | "master",
  idempotencyKey: string | undefined,
): Promise<GenerationSession | null> {
  if (!idempotencyKey || !contentId) return null;

  const item = await prisma.contentItem.findFirst({
    where: {
      id: contentId,
      organisationId: scope.organisationId,
      brandId: scope.brandId,
      archivedAt: null,
    },
    include: {
      complianceChecks: { orderBy: { checkedAt: "desc" }, take: 30 },
    },
  });
  if (!item) return null;

  const { parsed } = await getProvenanceForContent(contentId, scope);
  const storedKey =
    operation === "brief"
      ? parsed.idempotency?.briefKey
      : parsed.idempotency?.masterKey;

  if (storedKey === idempotencyKey) {
    return sessionFromItem(item, parsed);
  }

  return null;
}

export const contentIntelligenceGenerationService = {
  async getSession(
    brandId: string,
    organisationId: string,
    contentId: string,
    context: TenantContext,
  ): Promise<GenerationSession> {
    const scope = await resolveBrandScope(brandId, organisationId, context);
    const item = await prisma.contentItem.findFirst({
      where: {
        id: contentId,
        organisationId: scope.organisationId,
        brandId: scope.brandId,
        archivedAt: null,
        studioType: { not: null },
      },
      include: {
        complianceChecks: { orderBy: { checkedAt: "desc" }, take: 30 },
      },
    });
    if (!item) {
      throw new AppError("NOT_FOUND", "Content intelligence session was not found.");
    }
    const { parsed } = await getProvenanceForContent(contentId, scope);
    return sessionFromItem(item, parsed);
  },

  async generateBrief(
    brandId: string,
    organisationId: string,
    input: ContentIntelligenceBriefGenerateInput,
    context: TenantContext,
    requestId?: string,
  ): Promise<GenerationSession> {
    const scope = await resolveBrandScope(brandId, organisationId, context);

    if (input.contentId && input.idempotencyKey) {
      const cached = await assertIdempotency(
        scope,
        input.contentId,
        "brief",
        input.idempotencyKey,
      );
      if (cached) return cached;
    }

    const generationContext = await resolveGenerationContext(
      scope,
      input,
      context,
    );
    const sourceEvidence = await resolveSourceEvidence(scope, input);

    const template = await promptTemplateService.getActiveTemplate("content.intelligence.brief");
    let aiResult: Awaited<ReturnType<typeof aiRequestService.executeStructured>>;
    try {
      aiResult = await aiRequestService.executeStructured(
        {
          organisationId: scope.organisationId,
          projectId: scope.projectId,
          brandId: scope.brandId,
          userProfileId: context.userProfileId,
          purpose: "CONTENT_DRAFT",
          templateKey: "content.intelligence.brief",
          schemaKey: "content.intelligence.brief",
          userInput: buildBriefGenerationPrompt(generationContext, sourceEvidence),
          brandContext: generationContext.brandContext as unknown as Record<string, unknown>,
          requestId,
        },
        context,
      );
    } catch (error) {
      mapProviderError(error, BRIEF_GENERATION_ERROR);
    }

    const validated = contentIntelligenceBriefOutputSchema.safeParse(aiResult!.output);
    if (!validated.success) {
      throw new AppError("VALIDATION_ERROR", BRIEF_GENERATION_ERROR);
    }

    const structuredBrief = mapBriefOutput(validated.data, generationContext);
    const studioFields = briefToStudioFields(structuredBrief);
    const provenanceMetadata = buildProvenanceMetadata({
      briefId: input.contentId ?? "pending",
      creationMode: input.mode,
      brandId: scope.brandId,
      campaignId: generationContext.campaignId,
      sourceOpportunity:
        sourceEvidence && input.sourceOpportunityId
          ? {
              id: input.sourceOpportunityId,
              source: input.mode,
              title: sourceEvidence.label,
            }
          : null,
      structuredBrief,
      briefGeneration: {
        aiRequestId: aiResult!.aiRequestId,
        provider: aiResult!.provider,
        model: aiResult!.model,
        generatedAt: new Date().toISOString(),
        humanEdited: false,
        operationType: "brief_generation",
      },
      brandKnowledgeSnapshot: {
        snapshotAt: new Date().toISOString(),
        usedRecords: generationContext.brandContext.usedRecords,
      },
      idempotency: input.idempotencyKey ? { briefKey: input.idempotencyKey } : undefined,
    });

    let contentId = input.contentId;
    if (contentId) {
      const existing = await prisma.contentItem.findFirst({
        where: {
          id: contentId,
          organisationId: scope.organisationId,
          brandId: scope.brandId,
          archivedAt: null,
        },
      });
      if (!existing) {
        throw new AppError("NOT_FOUND", "Content intelligence session was not found.");
      }

      provenanceMetadata.briefId = contentId;
      await prisma.$transaction([
        prisma.contentItem.update({
          where: { id: contentId },
          data: {
            title: studioFields.title,
            studioObjective: studioFields.studioObjective,
            audienceSummary: studioFields.audienceSummary,
            primaryMessage: studioFields.primaryMessage,
            primaryCTA: studioFields.primaryCTA,
            contentPillar: studioFields.contentPillar,
            status: ContentStatus.BRIEF,
            contentCampaignId: generationContext.campaignId,
            campaignName: generationContext.campaignLabel,
            targetAudienceId: generationContext.audienceId,
          },
        }),
        prisma.contentProvenance.upsert({
          where: { contentItemId: contentId },
          create: {
            organisationId: scope.organisationId,
            projectId: scope.projectId,
            brandId: scope.brandId,
            contentItemId: contentId,
            createdManually: false,
            aiProvider: aiResult!.provider,
            aiModel: aiResult!.model,
            promptTemplateVersionId: template.activeVersion!.id,
            generatedAt: new Date(),
            metadata: provenanceMetadata as Prisma.InputJsonValue,
          },
          update: {
            createdManually: false,
            aiProvider: aiResult!.provider,
            aiModel: aiResult!.model,
            promptTemplateVersionId: template.activeVersion!.id,
            generatedAt: new Date(),
            metadata: provenanceMetadata as Prisma.InputJsonValue,
          },
        }),
      ]);
    } else {
      const created = await prisma.$transaction(async (tx) => {
        const item = await tx.contentItem.create({
          data: {
            organisationId: scope.organisationId,
            projectId: scope.projectId,
            brandId: scope.brandId,
            title: studioFields.title,
            studioType: input.studioType,
            contentType: "TEXT_POST",
            studioObjective: studioFields.studioObjective,
            audienceSummary: studioFields.audienceSummary,
            primaryMessage: studioFields.primaryMessage,
            primaryCTA: studioFields.primaryCTA,
            contentPillar: studioFields.contentPillar,
            contentCampaignId: generationContext.campaignId,
            campaignName: generationContext.campaignLabel,
            targetAudienceId: generationContext.audienceId,
            status: ContentStatus.BRIEF,
            version: 1,
            ownerUserId: context.userProfileId,
            createdByUserId: context.userProfileId,
          },
        });

        provenanceMetadata.briefId = item.id;
        await tx.contentProvenance.create({
          data: {
            organisationId: scope.organisationId,
            projectId: scope.projectId,
            brandId: scope.brandId,
            contentItemId: item.id,
            createdManually: false,
            aiProvider: aiResult!.provider,
            aiModel: aiResult!.model,
            promptTemplateVersionId: template.activeVersion!.id,
            generatedAt: new Date(),
            metadata: provenanceMetadata as Prisma.InputJsonValue,
          },
        });

        return item;
      });
      contentId = created.id;
    }

    return this.getSession(brandId, organisationId, contentId!, context);
  },

  async updateBrief(
    brandId: string,
    organisationId: string,
    contentId: string,
    input: ContentIntelligenceBriefUpdateInput,
    context: TenantContext,
  ): Promise<GenerationSession> {
    const scope = await resolveBrandScope(brandId, organisationId, context);
    const { provenance: row, parsed } = await getProvenanceForContent(contentId, scope);

    const { expectedVersion: _expectedVersion, ...briefPatch } = input;
    const nextBrief: ContentBrief = {
      ...parsed.structuredBrief,
      ...briefPatch,
    };

    const studioFields = briefToStudioFields(nextBrief);
    const originalBrief = parsed.originalBrief ?? parsed.structuredBrief;
    const updatedMetadata: ContentIntelligenceProvenance = {
      ...parsed,
      structuredBrief: nextBrief,
      originalBrief,
      briefGeneration: {
        ...parsed.briefGeneration,
        humanEdited: true,
        editedAt: new Date().toISOString(),
        operationType: "content_revision",
      },
    };

    await prisma.$transaction([
      prisma.contentItem.update({
        where: { id: contentId },
        data: {
          title: studioFields.title,
          studioObjective: studioFields.studioObjective,
          audienceSummary: studioFields.audienceSummary,
          primaryMessage: studioFields.primaryMessage,
          primaryCTA: studioFields.primaryCTA,
          contentPillar: studioFields.contentPillar,
        },
      }),
      prisma.contentProvenance.update({
        where: { id: row.id },
        data: {
          metadata: updatedMetadata as Prisma.InputJsonValue,
        },
      }),
      prisma.contentRevision.create({
        data: {
          organisationId: scope.organisationId,
          projectId: scope.projectId,
          brandId: scope.brandId,
          contentItemId: contentId,
          revisionNumber: await nextRevisionNumber(contentId),
          changedFields: { action: "brief_edited", fields: Object.keys(input) } as Prisma.InputJsonValue,
          snapshot: { brief: nextBrief } as Prisma.InputJsonValue,
          editorUserId: context.userProfileId,
          source: ContentRevisionSource.HUMAN,
          changeNote: "Brief edited by user",
        },
      }),
    ]);

    return this.getSession(brandId, organisationId, contentId, context);
  },

  async generateMaster(
    brandId: string,
    organisationId: string,
    input: ContentIntelligenceMasterGenerateInput,
    context: TenantContext,
    requestId?: string,
  ): Promise<GenerationSession> {
    const scope = await resolveBrandScope(brandId, organisationId, context);

    const cached = await assertIdempotency(scope, input.contentId, "master", input.idempotencyKey);
    if (cached?.master) return cached;

    const { provenance: row, parsed } = await getProvenanceForContent(input.contentId, scope);
    const brief = provenanceToBrief(parsed);

    const item = await prisma.contentItem.findFirstOrThrow({
      where: {
        id: input.contentId,
        organisationId: scope.organisationId,
        brandId: scope.brandId,
        archivedAt: null,
      },
    });

    const studioType = input.studioType ?? item.studioType ?? ContentStudioType.SOCIAL_POST;
    const template = await promptTemplateService.getActiveTemplate("content.intelligence.master");

    let aiResult: Awaited<ReturnType<typeof aiRequestService.executeStructured>>;
    try {
      aiResult = await aiRequestService.executeStructured(
        {
          organisationId: scope.organisationId,
          projectId: scope.projectId,
          brandId: scope.brandId,
          userProfileId: context.userProfileId,
          purpose: "CONTENT_DRAFT",
          templateKey: "content.intelligence.master",
          schemaKey: "content.intelligence.master",
          userInput: buildMasterGenerationPrompt(brief, studioType),
          brandContext: parsed.brandKnowledgeSnapshot
            ? ({ usedRecords: parsed.brandKnowledgeSnapshot.usedRecords } as Record<string, unknown>)
            : undefined,
          requestId,
        },
        context,
      );
    } catch (error) {
      mapProviderError(error, MASTER_GENERATION_ERROR);
    }

    const validated = contentIntelligenceMasterOutputSchema.safeParse(aiResult!.output);
    if (!validated.success) {
      throw new AppError("VALIDATION_ERROR", MASTER_GENERATION_ERROR);
    }

    const master = mapMasterOutput(validated.data, brief, input.contentId, {
      aiRequestId: aiResult!.aiRequestId,
      provider: aiResult!.provider,
      model: aiResult!.model,
    });

    const updatedMetadata: ContentIntelligenceProvenance = {
      ...parsed,
      structuredMaster: {
        title: master.title,
        summary: master.summary,
        hook: master.hook,
        body: master.body,
        keyPoints: master.keyPoints,
        cta: master.cta,
        contentPillar: master.contentPillar,
        recommendedChannels: validated.data.recommendedChannels,
        riskFlags: validated.data.riskFlags,
      },
      masterGeneration: {
        aiRequestId: aiResult!.aiRequestId,
        provider: aiResult!.provider,
        model: aiResult!.model,
        generatedAt: new Date().toISOString(),
        humanEdited: false,
        operationType: "master_content_generation",
      },
      idempotency: {
        ...parsed.idempotency,
        masterKey: input.idempotencyKey,
      },
    };

    await prisma.$transaction([
      prisma.contentItem.update({
        where: { id: input.contentId },
        data: {
          title: master.title,
          contentBody: master.body,
          primaryMessage: master.body,
          primaryCTA: master.cta,
          contentPillar: master.contentPillar,
          studioType,
          status: ContentStatus.AI_GENERATED,
        },
      }),
      prisma.contentProvenance.update({
        where: { id: row.id },
        data: {
          aiProvider: aiResult!.provider,
          aiModel: aiResult!.model,
          promptTemplateVersionId: template.activeVersion!.id,
          generatedAt: new Date(),
          metadata: updatedMetadata as Prisma.InputJsonValue,
        },
      }),
      prisma.contentRevision.create({
        data: {
          organisationId: scope.organisationId,
          projectId: scope.projectId,
          brandId: scope.brandId,
          contentItemId: input.contentId,
          revisionNumber: await nextRevisionNumber(input.contentId),
          changedFields: { action: "master_generated" } as Prisma.InputJsonValue,
          snapshot: { master: validated.data } as Prisma.InputJsonValue,
          editorUserId: context.userProfileId,
          source: ContentRevisionSource.AI,
          changeNote: "Master content generated by AI",
        },
      }),
    ]);

    await contentStudioService.runCompliance(brandId, organisationId, input.contentId, context);

    return this.getSession(brandId, organisationId, input.contentId, context);
  },

  async updateMaster(
    brandId: string,
    organisationId: string,
    contentId: string,
    input: ContentIntelligenceMasterUpdateInput,
    context: TenantContext,
    requestId?: string,
  ): Promise<GenerationSession> {
    const scope = await resolveBrandScope(brandId, organisationId, context);
    const { provenance: row, parsed } = await getProvenanceForContent(contentId, scope);
    const item = await prisma.contentItem.findFirstOrThrow({
      where: {
        id: contentId,
        organisationId: scope.organisationId,
        brandId: scope.brandId,
      },
    });

    await contentStudioService.update(
      brandId,
      organisationId,
      contentId,
      {
        title: input.title,
        contentBody: input.body,
        primaryCTA: input.cta ?? undefined,
        contentPillar: input.contentPillar ?? undefined,
        expectedVersion: input.expectedVersion,
      },
      context,
      requestId,
    );

    const updatedMetadata: ContentIntelligenceProvenance = {
      ...parsed,
      structuredMaster: {
        title: input.title ?? parsed.structuredMaster?.title ?? item.title,
        summary: input.summary ?? parsed.structuredMaster?.summary ?? null,
        hook: input.hook ?? parsed.structuredMaster?.hook ?? null,
        body: input.body ?? parsed.structuredMaster?.body ?? item.contentBody ?? "",
        keyPoints: input.keyPoints ?? parsed.structuredMaster?.keyPoints ?? [],
        cta: input.cta ?? parsed.structuredMaster?.cta ?? item.primaryCTA,
        contentPillar: input.contentPillar ?? parsed.structuredMaster?.contentPillar ?? item.contentPillar,
        recommendedChannels: parsed.structuredMaster?.recommendedChannels,
        riskFlags: parsed.structuredMaster?.riskFlags,
      },
      masterGeneration: {
        ...parsed.masterGeneration,
        humanEdited: true,
        editedAt: new Date().toISOString(),
        operationType: "content_revision",
      },
    };

    await prisma.contentProvenance.update({
      where: { id: row.id },
      data: { metadata: updatedMetadata as Prisma.InputJsonValue },
    });

    return this.getSession(brandId, organisationId, contentId, context);
  },
};

async function nextRevisionNumber(contentItemId: string): Promise<number> {
  const latest = await prisma.contentRevision.findFirst({
    where: { contentItemId },
    orderBy: { revisionNumber: "desc" },
  });
  return (latest?.revisionNumber ?? 0) + 1;
}
