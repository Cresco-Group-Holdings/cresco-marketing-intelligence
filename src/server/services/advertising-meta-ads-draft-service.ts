import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import { mapPlanToMetaAdsDraft, type PlanDraftInput } from "@/lib/advertising-meta-ads/draft-mapper";
import { buildMutationOperations, hashMutationPlan, type MutationOperation } from "@/lib/advertising-meta-ads/mutation-plan";
import { validateMetaAdsDraftLocally } from "@/lib/advertising-meta-ads/validation";
import { AppError } from "@/lib/errors";
import type { TenantContext } from "@/lib/tenancy/context";
import { advertisingCampaignPlanService } from "@/server/services/advertising-campaign-plan-service";
import { advertisingMetaAdsAccountService } from "@/server/services/advertising-meta-ads-account-service";
import { brandService } from "@/server/services/workspace-service";

function planToDraftInput(plan: Awaited<ReturnType<typeof advertisingCampaignPlanService.getById>>): PlanDraftInput {
  return {
    planId: plan.id,
    planName: plan.name,
    internalCampaignId: plan.internalCampaignId,
    primaryObjective: plan.primaryObjective,
    reportingCurrency: plan.reportingCurrency,
    channels: plan.channels.map((c) => ({ channelType: c.channelType })),
    budgets: plan.budgets.map((b) => ({
      budgetType: b.budgetType,
      currency: b.currency,
      amount: Number(b.amount),
    })),
    destinations: plan.destinations.map((d) => ({ destinationUrl: d.destinationUrl })),
    placements: plan.placements.map((p) => ({ platforms: p.platforms })),
    creatives: plan.creatives.map((c) => ({
      format: c.format,
      headline: c.headline,
      description: c.description,
    })),
    targeting: { countries: ["US"], ageMin: 18, ageMax: 65 },
  };
}

export const advertisingMetaAdsDraftService = {
  async list(brandId: string, organisationId: string, context: TenantContext) {
    await brandService.getById(brandId, organisationId, context);
    return prisma.advertisingMetaAdsDraft.findMany({
      where: { organisationId, brandId },
      include: { plan: { select: { id: true, name: true, status: true } }, mutationPlans: { take: 1, orderBy: { createdAt: "desc" } } },
      orderBy: { updatedAt: "desc" },
      take: 50,
    });
  },

  async getById(draftId: string, brandId: string, organisationId: string, context: TenantContext) {
    await brandService.getById(brandId, organisationId, context);
    const draft = await prisma.advertisingMetaAdsDraft.findFirst({
      where: { id: draftId, organisationId, brandId },
      include: {
        plan: true,
        metaAdsAccount: true,
        mutationPlans: { orderBy: { createdAt: "desc" }, include: { launchApprovals: true, launches: true } },
      },
    });
    if (!draft) throw new AppError("NOT_FOUND", "Meta Ads draft not found.");
    return draft;
  },

  async createFromPlan(planId: string, brandId: string, organisationId: string, context: TenantContext) {
    const brand = await brandService.getById(brandId, organisationId, context);
    const plan = await advertisingCampaignPlanService.getById(planId, brandId, organisationId, context);
    if (!["APPROVED", "PROVIDER_CONFIGURATION", "READY_TO_LAUNCH"].includes(plan.status)) {
      throw new AppError("VALIDATION_ERROR", "Plan must be approved before generating a Meta provider draft.");
    }

    const metaAccount = await advertisingMetaAdsAccountService.requireAccount(brandId, organisationId, context);
    const channelTypes = plan.channels
      .filter((c) => c.channelType.startsWith("META_"))
      .map((c) => c.channelType);

    const draftPayload = mapPlanToMetaAdsDraft(planToDraftInput(plan), {
      facebookPageId: metaAccount.facebookPageId ?? undefined,
      instagramAccountId: metaAccount.instagramAccountId ?? undefined,
      pixelId: metaAccount.pixelId ?? undefined,
      datasetId: metaAccount.datasetId ?? undefined,
    });
    const localValidation = validateMetaAdsDraftLocally(draftPayload);

    const existing = await prisma.advertisingCampaignProviderDraft.findFirst({
      where: { planId, provider: "META" },
    });
    const providerDraft = existing ?
      await prisma.advertisingCampaignProviderDraft.update({
        where: { id: existing.id },
        data: {
          draftPayload: draftPayload as unknown as Prisma.InputJsonValue,
          validationResult: localValidation as unknown as Prisma.InputJsonValue,
          validationStatus: localValidation.valid ? "PASSED" : "FAILED",
          providerAccountId: metaAccount.adAccountId,
        },
      })
    : await prisma.advertisingCampaignProviderDraft.create({
        data: {
          organisationId,
          planId,
          provider: "META",
          channelType: channelTypes.includes("META_INSTAGRAM") ? "META_INSTAGRAM" : "META_FACEBOOK",
          draftPayload: draftPayload as unknown as Prisma.InputJsonValue,
          validationResult: localValidation as unknown as Prisma.InputJsonValue,
          validationStatus: localValidation.valid ? "PASSED" : "FAILED",
          providerAccountId: metaAccount.adAccountId,
        },
      });

    return prisma.advertisingMetaAdsDraft.create({
      data: {
        organisationId,
        projectId: brand.projectId,
        brandId,
        planId,
        metaAdsAccountId: metaAccount.id,
        providerDraftId: providerDraft.id,
        channelTypes,
        objective: draftPayload.campaign.objective,
        draftPayload: draftPayload as unknown as Prisma.InputJsonValue,
        validationResult: localValidation as unknown as Prisma.InputJsonValue,
        validationStatus: localValidation.valid ? "PASSED" : "FAILED",
        reviewStatus: "PENDING",
        status: localValidation.valid ? "VALIDATED" : "DRAFT",
        createdByUserId: context.userProfileId,
      },
    });
  },

  async buildMutationPlan(draftId: string, brandId: string, organisationId: string, context: TenantContext) {
    const draft = await this.getById(draftId, brandId, organisationId, context);
    const account = draft.metaAdsAccount;
    const payload = draft.draftPayload as ReturnType<typeof mapPlanToMetaAdsDraft>;

    const preview = buildMutationOperations(payload, {
      adAccountId: account.adAccountId,
      facebookPageId: account.facebookPageId,
      instagramAccountId: account.instagramAccountId,
      currency: account.currency,
      timezone: account.timezone,
    });

    const operations = preview.operations as MutationOperation[];
    const planHash = hashMutationPlan(operations);

    return {
      mutationPlan: await prisma.advertisingMetaAdsMutationPlan.create({
        data: {
          organisationId,
          draftId,
          planHash,
          operations: operations as unknown as Prisma.InputJsonValue,
          resourcesCreated: preview.resourcesCreated,
          budgetSummary: preview.budgetSummary as unknown as Prisma.InputJsonValue,
          accountSnapshot: preview.accountSnapshot as unknown as Prisma.InputJsonValue,
          targetingSummary: preview.targetingSummary as unknown as Prisma.InputJsonValue,
          creativeSummary: preview.creativeSummary as unknown as Prisma.InputJsonValue,
          trackingSummary: preview.trackingSummary as unknown as Prisma.InputJsonValue,
          risks: preview.risks,
          validationResult: draft.validationResult ?? undefined,
          validationStatus: draft.validationStatus,
          createdByUserId: context.userProfileId,
        },
      }),
      preview,
      planHash,
    };
  },
};
