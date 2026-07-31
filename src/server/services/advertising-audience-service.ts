import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";
import { AUDIENCE_STATUS_TRANSITIONS } from "@/lib/advertising-audiences/constants";
import { isValidRetargetingWindow } from "@/lib/advertising-audiences/retargeting";
import { validateRule } from "@/lib/advertising-audiences/rule-allowlist";
import type { TenantContext } from "@/lib/tenancy/context";
import { brandService } from "@/server/services/workspace-service";

function assertTransition(from: string, to: string) {
  const allowed = AUDIENCE_STATUS_TRANSITIONS[from as keyof typeof AUDIENCE_STATUS_TRANSITIONS] ?? [];
  if (!allowed.includes(to as never)) {
    throw new AppError("VALIDATION_ERROR", `Cannot transition audience from ${from} to ${to}.`);
  }
}

const audienceInclude = {
  rules: { orderBy: { sortOrder: "asc" as const } },
  segments: true,
  estimates: { orderBy: { calculatedAt: "desc" as const }, take: 5 },
  exclusions: true,
  consentPolicy: true,
  providerMappings: true,
  eligibilityChecks: { orderBy: { checkedAt: "desc" as const }, take: 30 },
  versions: { orderBy: { versionNumber: "desc" as const }, take: 10 },
  campaignPlan: { select: { id: true, name: true } },
  brandAudience: { select: { id: true, name: true } },
} satisfies Prisma.AdvertisingAudienceInclude;

export const advertisingAudienceService = {
  async list(brandId: string, organisationId: string, context: TenantContext) {
    await brandService.getById(brandId, organisationId, context);
    return prisma.advertisingAudience.findMany({
      where: { organisationId, brandId, archivedAt: null },
      include: {
        _count: { select: { rules: true, exclusions: true, estimates: true } },
        estimates: { orderBy: { calculatedAt: "desc" }, take: 1 },
      },
      orderBy: { updatedAt: "desc" },
      take: 100,
    });
  },

  async getById(audienceId: string, brandId: string, organisationId: string, context: TenantContext) {
    await brandService.getById(brandId, organisationId, context);
    const audience = await prisma.advertisingAudience.findFirst({
      where: { id: audienceId, organisationId, brandId },
      include: audienceInclude,
    });
    if (!audience) throw new AppError("NOT_FOUND", "Advertising audience not found.");
    return audience;
  },

  async create(
    brandId: string,
    organisationId: string,
    input: {
      name: string;
      description?: string;
      audienceType: string;
      campaignPlanId?: string;
      brandAudienceId?: string;
      retargetingWindowDays?: number;
      dataSources?: string[];
    },
    context: TenantContext,
  ) {
    const brand = await brandService.getById(brandId, organisationId, context);
    if (input.retargetingWindowDays && !isValidRetargetingWindow(input.retargetingWindowDays)) {
      throw new AppError("VALIDATION_ERROR", "Invalid retargeting window.");
    }

    const audience = await prisma.advertisingAudience.create({
      data: {
        organisationId,
        projectId: brand.projectId,
        brandId,
        name: input.name,
        description: input.description,
        audienceType: input.audienceType as Prisma.AdvertisingAudienceCreateInput["audienceType"],
        campaignPlanId: input.campaignPlanId,
        brandAudienceId: input.brandAudienceId,
        retargetingWindowDays: input.retargetingWindowDays,
        dataSources: (input.dataSources ?? []) as Prisma.AdvertisingAudienceCreateInput["dataSources"],
        ownerUserId: context.userProfileId,
        createdByUserId: context.userProfileId,
        status: "DRAFT",
      },
    });

    await prisma.advertisingAudienceConsentPolicy.create({
      data: {
        organisationId,
        audienceId: audience.id,
        marketingConsentRequired: true,
        deletionExcluded: true,
        customerListEligible: false,
      },
    });

    return audience;
  },

  async addRule(
    audienceId: string,
    brandId: string,
    organisationId: string,
    input: { ruleKey: string; operator: string; value: unknown; logicGroup?: string },
    context: TenantContext,
  ) {
    await this.getById(audienceId, brandId, organisationId, context);
    const validation = validateRule(input);
    if (!validation.valid) throw new AppError("VALIDATION_ERROR", validation.errors.join(" "));

    return prisma.advertisingAudienceRule.create({
      data: {
        organisationId,
        audienceId,
        ruleKey: input.ruleKey,
        operator: input.operator as Prisma.AdvertisingAudienceRuleCreateInput["operator"],
        value: input.value as Prisma.InputJsonValue,
        logicGroup: input.logicGroup ?? "AND",
      },
    });
  },

  async addExclusion(
    audienceId: string,
    brandId: string,
    organisationId: string,
    input: { exclusionType: string; description?: string; ruleKey?: string },
    context: TenantContext,
  ) {
    await this.getById(audienceId, brandId, organisationId, context);
    return prisma.advertisingAudienceExclusion.create({
      data: {
        organisationId,
        audienceId,
        exclusionType: input.exclusionType as Prisma.AdvertisingAudienceExclusionCreateInput["exclusionType"],
        description: input.description,
        ruleKey: input.ruleKey,
      },
    });
  },

  async updateConsentPolicy(
    audienceId: string,
    brandId: string,
    organisationId: string,
    input: {
      marketingConsentRequired?: boolean;
      dataSources?: string[];
      retentionDays?: number;
      permittedPurpose?: string;
      customerListEligible?: boolean;
      deletionExcluded?: boolean;
      geoRestrictions?: string[];
    },
    context: TenantContext,
  ) {
    await this.getById(audienceId, brandId, organisationId, context);
    return prisma.advertisingAudienceConsentPolicy.upsert({
      where: { audienceId },
      create: {
        organisationId,
        audienceId,
        marketingConsentRequired: input.marketingConsentRequired ?? true,
        dataSources: (input.dataSources ?? []) as Prisma.AdvertisingAudienceConsentPolicyCreateInput["dataSources"],
        retentionDays: input.retentionDays,
        permittedPurpose: input.permittedPurpose,
        customerListEligible: input.customerListEligible ?? false,
        deletionExcluded: input.deletionExcluded ?? true,
        geoRestrictions: input.geoRestrictions ?? [],
      },
      update: {
        marketingConsentRequired: input.marketingConsentRequired,
        dataSources: input.dataSources as Prisma.AdvertisingAudienceConsentPolicyUpdateInput["dataSources"],
        retentionDays: input.retentionDays,
        permittedPurpose: input.permittedPurpose,
        customerListEligible: input.customerListEligible,
        deletionExcluded: input.deletionExcluded,
        geoRestrictions: input.geoRestrictions,
      },
    });
  },

  async createVersion(audienceId: string, brandId: string, organisationId: string, context: TenantContext, changeNote?: string) {
    const audience = await this.getById(audienceId, brandId, organisationId, context);
    const versionNumber = (audience.versions[0]?.versionNumber ?? 0) + 1;
    return prisma.advertisingAudienceVersion.create({
      data: {
        organisationId,
        audienceId,
        versionNumber,
        status: audience.status,
        snapshot: {
          rules: audience.rules,
          exclusions: audience.exclusions,
          consentPolicy: audience.consentPolicy,
          estimates: audience.estimates,
        } as Prisma.InputJsonValue,
        changeNote,
        createdByUserId: context.userProfileId,
      },
    });
  },

  async updateStatus(audienceId: string, brandId: string, organisationId: string, newStatus: string, context: TenantContext) {
    const audience = await this.getById(audienceId, brandId, organisationId, context);
    assertTransition(audience.status, newStatus);
    return prisma.advertisingAudience.update({
      where: { id: audienceId },
      data: { status: newStatus as Prisma.AdvertisingAudienceUpdateInput["status"] },
    });
  },
};
