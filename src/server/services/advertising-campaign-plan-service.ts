import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";
import { PLAN_STATUS_TRANSITIONS } from "@/lib/advertising-plans/constants";
import { generateInternalCampaignId } from "@/lib/advertising-plans/naming";
import { validateBudgetDates, validateCurrencyPreservation } from "@/lib/advertising-plans/budget-validation";
import { validateSchedule } from "@/lib/advertising-plans/schedule-validation";
import type { TenantContext } from "@/lib/tenancy/context";
import { brandService } from "@/server/services/workspace-service";

function assertTransition(from: string, to: string) {
  const allowed = PLAN_STATUS_TRANSITIONS[from as keyof typeof PLAN_STATUS_TRANSITIONS] ?? [];
  if (!allowed.includes(to as never)) {
    throw new AppError("VALIDATION_ERROR", `Cannot transition plan from ${from} to ${to}.`);
  }
}

export const advertisingCampaignPlanService = {
  async list(brandId: string, organisationId: string, context: TenantContext) {
    await brandService.getById(brandId, organisationId, context);
    return prisma.advertisingCampaignPlan.findMany({
      where: { organisationId, brandId, archivedAt: null },
      include: {
        _count: { select: { channels: true, budgets: true, approvals: true, creatives: true } },
        owner: { select: { id: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 100,
    });
  },

  async getById(planId: string, brandId: string, organisationId: string, context: TenantContext) {
    await brandService.getById(brandId, organisationId, context);
    const plan = await prisma.advertisingCampaignPlan.findFirst({
      where: { id: planId, organisationId, brandId },
      include: {
        objectives: true,
        channels: { orderBy: { sortOrder: "asc" } },
        budgets: true,
        schedule: true,
        destinations: true,
        conversionGoals: { include: { conversionDefinition: true } },
        audiences: true,
        placements: true,
        creatives: { include: { marketingAsset: true, contentItem: true } },
        readinessChecks: { orderBy: { checkedAt: "desc" }, take: 50 },
        approvals: { orderBy: { createdAt: "desc" }, take: 20 },
        providerDrafts: true,
        versions: { orderBy: { versionNumber: "desc" }, take: 10 },
      },
    });
    if (!plan) throw new AppError("NOT_FOUND", "Campaign plan not found.");
    return plan;
  },

  async create(
    brandId: string,
    organisationId: string,
    input: {
      name: string;
      description?: string;
      primaryObjective?: string;
      reportingCurrency?: string;
      startAt?: string;
      endAt?: string;
      totalBudgetAmount?: number;
    },
    context: TenantContext,
  ) {
    const brand = await brandService.getById(brandId, organisationId, context);
    const scheduleErrors = validateSchedule({
      startAt: input.startAt ? new Date(input.startAt) : null,
      endAt: input.endAt ? new Date(input.endAt) : null,
    });
    if (scheduleErrors.errors.length) {
      throw new AppError("VALIDATION_ERROR", scheduleErrors.errors.join(" "));
    }

    return prisma.advertisingCampaignPlan.create({
      data: {
        organisationId,
        projectId: brand.projectId,
        brandId,
        internalCampaignId: generateInternalCampaignId(brand.slug),
        name: input.name,
        description: input.description,
        primaryObjective: input.primaryObjective as Prisma.AdvertisingCampaignPlanCreateInput["primaryObjective"],
        reportingCurrency: input.reportingCurrency ?? "USD",
        startAt: input.startAt ? new Date(input.startAt) : undefined,
        endAt: input.endAt ? new Date(input.endAt) : undefined,
        totalBudgetAmount: input.totalBudgetAmount,
        ownerUserId: context.userProfileId,
        createdByUserId: context.userProfileId,
        status: "DRAFT",
      },
    });
  },

  async updateStatus(planId: string, brandId: string, organisationId: string, newStatus: string, context: TenantContext) {
    const plan = await this.getById(planId, brandId, organisationId, context);
    assertTransition(plan.status, newStatus);
    return prisma.advertisingCampaignPlan.update({
      where: { id: planId },
      data: { status: newStatus as Prisma.AdvertisingCampaignPlanUpdateInput["status"] },
    });
  },

  async addChannel(planId: string, brandId: string, organisationId: string, input: { channelType: string; provider?: string; intendedCampaignType?: string }, context: TenantContext) {
    await this.getById(planId, brandId, organisationId, context);
    return prisma.advertisingCampaignChannel.create({
      data: {
        organisationId,
        planId,
        channelType: input.channelType as Prisma.AdvertisingCampaignChannelCreateInput["channelType"],
        provider: input.provider,
        intendedCampaignType: input.intendedCampaignType,
      },
    });
  },

  async addBudget(
    planId: string,
    brandId: string,
    organisationId: string,
    input: {
      channelId?: string;
      budgetType: string;
      currency: string;
      amount: number;
      plannedStart?: string;
      plannedEnd?: string;
    },
    context: TenantContext,
  ) {
    const plan = await this.getById(planId, brandId, organisationId, context);
    if (!validateCurrencyPreservation(plan.reportingCurrency, input.currency)) {
      throw new AppError("VALIDATION_ERROR", "Budget currency must match plan reporting currency.");
    }
    const dateErrors = validateBudgetDates(
      input.plannedStart ? new Date(input.plannedStart) : null,
      input.plannedEnd ? new Date(input.plannedEnd) : null,
    );
    if (dateErrors.length) throw new AppError("VALIDATION_ERROR", dateErrors.join(" "));

    return prisma.advertisingCampaignBudget.create({
      data: {
        organisationId,
        planId,
        channelId: input.channelId,
        budgetType: input.budgetType as Prisma.AdvertisingCampaignBudgetCreateInput["budgetType"],
        currency: input.currency,
        amount: input.amount,
        plannedStart: input.plannedStart ? new Date(input.plannedStart) : undefined,
        plannedEnd: input.plannedEnd ? new Date(input.plannedEnd) : undefined,
      },
    });
  },

  async addAudience(
    planId: string,
    brandId: string,
    organisationId: string,
    input: { audienceType: string; name: string; description?: string; logicSpec?: Record<string, unknown>; brandAudienceId?: string; isExclusion?: boolean },
    context: TenantContext,
  ) {
    await this.getById(planId, brandId, organisationId, context);
    return prisma.advertisingCampaignAudiencePlan.create({
      data: {
        organisationId,
        planId,
        audienceType: input.audienceType as Prisma.AdvertisingCampaignAudiencePlanCreateInput["audienceType"],
        name: input.name,
        description: input.description,
        logicSpec: (input.logicSpec ?? {}) as Prisma.InputJsonValue,
        brandAudienceId: input.brandAudienceId,
        isExclusion: input.isExclusion ?? false,
      },
    });
  },

  async addConversionGoal(
    planId: string,
    brandId: string,
    organisationId: string,
    input: { conversionDefinitionId?: string; isPrimary?: boolean; conversionValue?: number; valueCurrency?: string; attributionModel?: string },
    context: TenantContext,
  ) {
    await this.getById(planId, brandId, organisationId, context);
    return prisma.advertisingCampaignConversionGoal.create({
      data: {
        organisationId,
        planId,
        conversionDefinitionId: input.conversionDefinitionId,
        isPrimary: input.isPrimary ?? false,
        conversionValue: input.conversionValue,
        valueCurrency: input.valueCurrency,
        attributionModel: input.attributionModel,
        trackingVerified: false,
      },
    });
  },

  async attachCreative(
    planId: string,
    brandId: string,
    organisationId: string,
    input: { format: string; marketingAssetId?: string; contentItemId?: string; headline?: string; cta?: string },
    context: TenantContext,
  ) {
    await this.getById(planId, brandId, organisationId, context);
    if (input.marketingAssetId) {
      const asset = await prisma.marketingAsset.findFirst({
        where: { id: input.marketingAssetId, brandId, organisationId },
      });
      if (!asset?.approvedForMarketing) {
        throw new AppError("VALIDATION_ERROR", "Asset must be approved for marketing.");
      }
    }
    return prisma.advertisingCampaignCreativePlan.create({
      data: {
        organisationId,
        planId,
        format: input.format,
        marketingAssetId: input.marketingAssetId,
        contentItemId: input.contentItemId,
        headline: input.headline,
        cta: input.cta,
        approvalStatus: input.marketingAssetId ? "APPROVED" : "DRAFT",
      },
    });
  },

  async addDestination(
    planId: string,
    brandId: string,
    organisationId: string,
    input: {
      destinationType: string;
      destinationUrl?: string;
      utmTemplate?: string;
      mobileUrl?: string;
      crawlPageId?: string;
    },
    context: TenantContext,
  ) {
    await this.getById(planId, brandId, organisationId, context);
    const httpsStatus = input.destinationUrl?.startsWith("https://") ?? false;
    return prisma.advertisingCampaignDestination.create({
      data: {
        organisationId,
        planId,
        destinationType: input.destinationType as Prisma.AdvertisingCampaignDestinationCreateInput["destinationType"],
        destinationUrl: input.destinationUrl,
        utmTemplate: input.utmTemplate,
        mobileUrl: input.mobileUrl,
        crawlPageId: input.crawlPageId,
        httpsStatus,
        pageVerified: false,
        conversionReady: false,
      },
    });
  },
};
