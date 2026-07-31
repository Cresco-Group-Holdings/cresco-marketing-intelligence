import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import { mapPlanToGoogleAdsDraft, type PlanDraftInput } from "@/lib/advertising-google-ads/draft-mapper";
import {
  buildMutationOperations,
  hashMutationPlan,
  type MutationOperation,
} from "@/lib/advertising-google-ads/mutation-plan";
import { validateGoogleAdsDraftLocally } from "@/lib/advertising-google-ads/validation";
import { AppError } from "@/lib/errors";
import type { TenantContext } from "@/lib/tenancy/context";
import { advertisingCampaignPlanService } from "@/server/services/advertising-campaign-plan-service";
import { advertisingGoogleAdsAccountService } from "@/server/services/advertising-google-ads-account-service";
import { brandService } from "@/server/services/workspace-service";

function planToDraftInput(plan: Awaited<ReturnType<typeof advertisingCampaignPlanService.getById>>): PlanDraftInput {
  return {
    planId: plan.id,
    planName: plan.name,
    internalCampaignId: plan.internalCampaignId,
    reportingCurrency: plan.reportingCurrency,
    startAt: plan.startAt,
    endAt: plan.endAt,
    totalBudgetAmount: plan.totalBudgetAmount ? Number(plan.totalBudgetAmount) : null,
    channels: plan.channels.map((c) => ({ channelType: c.channelType, provider: c.provider })),
    budgets: plan.budgets.map((b) => ({
      budgetType: b.budgetType,
      currency: b.currency,
      amount: Number(b.amount),
      dailyAmount: b.budgetType === "DAILY" ? Number(b.amount) : null,
    })),
    schedule: plan.schedule,
    destinations: plan.destinations.map((d) => ({
      destinationUrl: d.destinationUrl,
    })),
    conversionGoals: plan.conversionGoals.map((g) => ({
      isPrimary: g.isPrimary,
      trackingVerified: g.trackingVerified,
      conversionDefinitionId: g.conversionDefinitionId ?? undefined,
    })),
    placements: plan.placements.map((p) => ({
      targetCountries: p.platforms.length ? p.platforms : ["US"],
      targetLanguages: ["en"],
    })),
    creatives: plan.creatives.map((c) => ({
      format: c.format,
      headlines: c.headline ? [c.headline] : undefined,
      descriptions: c.description ? [c.description] : undefined,
    })),
  };
}

export const advertisingGoogleAdsDraftService = {
  async list(brandId: string, organisationId: string, context: TenantContext) {
    await brandService.getById(brandId, organisationId, context);
    return prisma.advertisingGoogleAdsDraft.findMany({
      where: { organisationId, brandId },
      include: { plan: { select: { id: true, name: true, status: true } }, mutationPlans: { take: 1, orderBy: { createdAt: "desc" } } },
      orderBy: { updatedAt: "desc" },
      take: 50,
    });
  },

  async getById(draftId: string, brandId: string, organisationId: string, context: TenantContext) {
    await brandService.getById(brandId, organisationId, context);
    const draft = await prisma.advertisingGoogleAdsDraft.findFirst({
      where: { id: draftId, organisationId, brandId },
      include: {
        plan: true,
        googleAdsAccount: true,
        mutationPlans: { orderBy: { createdAt: "desc" }, include: { launchApprovals: true, launches: true } },
      },
    });
    if (!draft) throw new AppError("NOT_FOUND", "Google Ads draft not found.");
    return draft;
  },

  async createFromPlan(planId: string, brandId: string, organisationId: string, context: TenantContext) {
    const brand = await brandService.getById(brandId, organisationId, context);
    const plan = await advertisingCampaignPlanService.getById(planId, brandId, organisationId, context);
    if (!["APPROVED", "PROVIDER_CONFIGURATION", "READY_TO_LAUNCH"].includes(plan.status)) {
      throw new AppError("VALIDATION_ERROR", "Plan must be approved before generating a Google Ads provider draft.");
    }

    const googleAccount = await advertisingGoogleAdsAccountService.requireAccount(brandId, organisationId, context);
    const draftPayload = mapPlanToGoogleAdsDraft(planToDraftInput(plan));
    const localValidation = validateGoogleAdsDraftLocally(draftPayload);

    const providerDraftExisting = await prisma.advertisingCampaignProviderDraft.findFirst({
      where: { planId, provider: "GOOGLE_ADS" },
    });

    const providerDraft = providerDraftExisting ?
      await prisma.advertisingCampaignProviderDraft.update({
        where: { id: providerDraftExisting.id },
        data: {
          draftPayload: draftPayload as unknown as Prisma.InputJsonValue,
          validationResult: localValidation as unknown as Prisma.InputJsonValue,
          validationStatus: localValidation.valid ? "PASSED" : "FAILED",
          providerAccountId: googleAccount.customerId,
        },
      })
    : await prisma.advertisingCampaignProviderDraft.create({
        data: {
          organisationId,
          planId,
          provider: "GOOGLE_ADS",
          channelType: "GOOGLE_SEARCH",
          draftPayload: draftPayload as unknown as Prisma.InputJsonValue,
          validationResult: localValidation as unknown as Prisma.InputJsonValue,
          validationStatus: localValidation.valid ? "PASSED" : "FAILED",
          providerAccountId: googleAccount.customerId,
        },
      });

    return prisma.advertisingGoogleAdsDraft.create({
      data: {
        organisationId,
        projectId: brand.projectId,
        brandId,
        planId,
        googleAdsAccountId: googleAccount.id,
        providerDraftId: providerDraft.id,
        campaignType: "SEARCH",
        draftPayload: draftPayload as unknown as Prisma.InputJsonValue,
        validationResult: localValidation as unknown as Prisma.InputJsonValue,
        validationStatus: localValidation.valid ? "PASSED" : "FAILED",
        status: localValidation.valid ? "VALIDATED" : "DRAFT",
        createdByUserId: context.userProfileId,
      },
    });
  },

  async buildMutationPlan(draftId: string, brandId: string, organisationId: string, context: TenantContext) {
    const draft = await this.getById(draftId, brandId, organisationId, context);
    const account = draft.googleAdsAccount;
    const payload = draft.draftPayload as ReturnType<typeof mapPlanToGoogleAdsDraft>;

    const preview = buildMutationOperations(payload, {
      customerId: account.customerId,
      managerCustomerId: account.managerCustomerId,
      currency: account.currency,
      timezone: account.timezone,
      accessLevel: account.accessLevel,
    });

    const operations = preview.operations as MutationOperation[];
    const planHash = hashMutationPlan(operations);

    const mutationPlan = await prisma.advertisingGoogleAdsMutationPlan.create({
      data: {
        organisationId,
        draftId,
        planHash,
        operations: operations as unknown as Prisma.InputJsonValue,
        resourcesCreated: preview.resourcesCreated,
        resourcesChanged: preview.resourcesChanged,
        budgetSummary: preview.budgetSummary as unknown as Prisma.InputJsonValue,
        accountSnapshot: preview.accountSnapshot as unknown as Prisma.InputJsonValue,
        destinationSummary: preview.destinationSummary as unknown as Prisma.InputJsonValue,
        risks: preview.risks,
        validationResult: draft.validationResult ?? undefined,
        validationStatus: draft.validationStatus,
        createdByUserId: context.userProfileId,
      },
    });

    return { mutationPlan, preview, planHash };
  },
};
