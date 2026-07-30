import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import { mapPlanToLinkedInAdsDraft, type PlanDraftInput } from "@/lib/advertising-linkedin-ads/draft-mapper";
import { buildMutationOperations, hashMutationPlan, type MutationOperation } from "@/lib/advertising-linkedin-ads/mutation-plan";
import { validateLinkedInAdsDraft } from "@/lib/advertising-linkedin-ads/validation";
import { AppError } from "@/lib/errors";
import type { TenantContext } from "@/lib/tenancy/context";
import { advertisingCampaignPlanService } from "@/server/services/advertising-campaign-plan-service";
import { advertisingLinkedInAdsAccountService } from "@/server/services/advertising-linkedin-ads-account-service";
import { brandService } from "@/server/services/workspace-service";

function planToDraftInput(plan: Awaited<ReturnType<typeof advertisingCampaignPlanService.getById>>): PlanDraftInput {
  return {
    planId: plan.id,
    planName: plan.name,
    internalCampaignId: plan.internalCampaignId,
    primaryObjective: plan.primaryObjective,
    reportingCurrency: plan.reportingCurrency,
    channels: plan.channels.map((c) => ({ channelType: c.channelType })),
    budgets: plan.budgets.map((b) => ({ budgetType: b.budgetType, currency: b.currency, amount: Number(b.amount) })),
    destinations: plan.destinations.map((d) => ({ destinationUrl: d.destinationUrl })),
    creatives: plan.creatives.map((c) => ({ format: c.format, headline: c.headline, description: c.description })),
    targeting: { countries: ["US"], jobFunctions: ["marketing"], seniorities: ["manager"] },
  };
}

export const advertisingLinkedInAdsDraftService = {
  async list(brandId: string, organisationId: string, context: TenantContext) {
    await brandService.getById(brandId, organisationId, context);
    return prisma.advertisingLinkedInAdsDraft.findMany({
      where: { organisationId, brandId },
      include: { plan: { select: { id: true, name: true, status: true } }, mutationPlans: { take: 1, orderBy: { createdAt: "desc" } } },
      orderBy: { updatedAt: "desc" },
      take: 50,
    });
  },

  async getById(draftId: string, brandId: string, organisationId: string, context: TenantContext) {
    await brandService.getById(brandId, organisationId, context);
    const draft = await prisma.advertisingLinkedInAdsDraft.findFirst({
      where: { id: draftId, organisationId, brandId },
      include: {
        plan: true,
        linkedInAdsAccount: true,
        mutationPlans: { orderBy: { createdAt: "desc" }, include: { launchApprovals: true, launches: true } },
      },
    });
    if (!draft) throw new AppError("NOT_FOUND", "LinkedIn Ads draft not found.");
    return draft;
  },

  async createFromPlan(planId: string, brandId: string, organisationId: string, context: TenantContext) {
    const brand = await brandService.getById(brandId, organisationId, context);
    const plan = await advertisingCampaignPlanService.getById(planId, brandId, organisationId, context);
    if (!["APPROVED", "PROVIDER_CONFIGURATION", "READY_TO_LAUNCH"].includes(plan.status)) {
      throw new AppError("VALIDATION_ERROR", "Plan must be approved before generating a LinkedIn provider draft.");
    }

    const linkedInAccount = await advertisingLinkedInAdsAccountService.requireAccount(brandId, organisationId, context);
    const draftPayload = mapPlanToLinkedInAdsDraft(planToDraftInput(plan));
    const localValidation = validateLinkedInAdsDraft(draftPayload);

    const existing = await prisma.advertisingCampaignProviderDraft.findFirst({ where: { planId, provider: "LINKEDIN" } });
    const providerDraft = existing
      ? await prisma.advertisingCampaignProviderDraft.update({
          where: { id: existing.id },
          data: {
            draftPayload: draftPayload as unknown as Prisma.InputJsonValue,
            validationResult: localValidation as unknown as Prisma.InputJsonValue,
            validationStatus: localValidation.valid ? "PASSED" : "FAILED",
            providerAccountId: linkedInAccount.linkedInAccountId,
          },
        })
      : await prisma.advertisingCampaignProviderDraft.create({
          data: {
            organisationId,
            planId,
            provider: "LINKEDIN",
            channelType: "LINKEDIN",
            draftPayload: draftPayload as unknown as Prisma.InputJsonValue,
            validationResult: localValidation as unknown as Prisma.InputJsonValue,
            validationStatus: localValidation.valid ? "PASSED" : "FAILED",
            providerAccountId: linkedInAccount.linkedInAccountId,
          },
        });

    return prisma.advertisingLinkedInAdsDraft.create({
      data: {
        organisationId,
        projectId: brand.projectId,
        brandId,
        planId,
        linkedInAdsAccountId: linkedInAccount.id,
        providerDraftId: providerDraft.id,
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
    const account = draft.linkedInAdsAccount;
    const payload = draft.draftPayload as ReturnType<typeof mapPlanToLinkedInAdsDraft>;

    const preview = buildMutationOperations(payload, {
      linkedInAccountId: account.linkedInAccountId,
      currency: account.currency,
      timezone: account.timezone,
    });

    const operations = preview.operations as MutationOperation[];
    const planHash = hashMutationPlan(operations);

    return {
      mutationPlan: await prisma.advertisingLinkedInAdsMutationPlan.create({
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
          optimisationSummary: preview.optimisationSummary as unknown as Prisma.InputJsonValue,
          destinationSummary: preview.destinationSummary as unknown as Prisma.InputJsonValue,
          providerWarnings: preview.providerWarnings,
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
