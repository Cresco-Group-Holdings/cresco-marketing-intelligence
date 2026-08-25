import type {
  CampaignActivityType,
  Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import { DEFAULT_CAMPAIGN_TIMEZONE } from "@/lib/campaigns/constants";
import {
  serializeCampaignActivity,
  serializeCampaignChannel,
  serializeCampaignDetail,
  serializeCampaignKpi,
  serializeCampaignMember,
  serializeCampaignSummary,
} from "@/lib/campaigns/serialize";
import {
  resolveTransitionAction,
  type CampaignTransitionAction,
} from "@/lib/campaigns/transitions";
import {
  formatValidationIssues,
  validateActivation,
  validateBudget,
  validateCampaignDates,
  validateReadiness,
} from "@/lib/campaigns/validation";
import { AppError } from "@/lib/errors";
import { assertOrganisationScope, type TenantContext } from "@/lib/tenancy/context";
import type {
  CampaignChannelCreateInput,
  CampaignChannelUpdateInput,
  CampaignCreateInput,
  CampaignKpiCreateInput,
  CampaignKpiUpdateInput,
  CampaignListFilters,
  CampaignMemberCreateInput,
  CampaignMemberUpdateInput,
  CampaignTransitionInput,
  CampaignUpdateInput,
} from "@/lib/validation/campaigns";
import { campaignActivityListSchema } from "@/lib/validation/campaigns";
import type { z } from "zod";
import { recordAuditEvent } from "@/server/services/audit-service";
import { brandService } from "@/server/services/workspace-service";
import { ENTITLEMENT_KEYS } from "@/lib/billing/entitlements";
import { entitlementService } from "@/server/services/entitlement-service";

const campaignDetailInclude = {
  owner: { select: { id: true, displayName: true, email: true } },
  brand: { select: { name: true } },
  channels: { orderBy: { sortOrder: "asc" as const } },
  kpis: { orderBy: { sortOrder: "asc" as const } },
  members: {
    where: { removedAt: null },
    include: { user: { select: { id: true, displayName: true, email: true } } },
  },
} satisfies Prisma.CampaignInclude;

const campaignSummaryInclude = {
  owner: { select: { id: true, displayName: true, email: true } },
  brand: { select: { name: true } },
  _count: { select: { channels: true, kpis: true, members: { where: { removedAt: null } } } },
} satisfies Prisma.CampaignInclude;

type CampaignScope = {
  organisationId: string;
  projectId: string;
  brandId: string;
};

async function resolveBrandScope(
  brandId: string,
  organisationId: string,
  context: TenantContext,
): Promise<CampaignScope> {
  const brand = await brandService.getById(brandId, organisationId, context);
  return { organisationId, projectId: brand.projectId, brandId };
}

async function assertActiveMember(organisationId: string, userId: string) {
  const membership = await prisma.organisationMembership.findFirst({
    where: { organisationId, userId, status: "ACTIVE" },
  });
  if (!membership) {
    throw new AppError("VALIDATION_ERROR", "Campaign members must be active organisation members.");
  }
  return membership;
}

async function getCampaignOrThrow(campaignId: string, organisationId: string) {
  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, organisationId },
    include: campaignDetailInclude,
  });
  if (!campaign) throw new AppError("NOT_FOUND", "Campaign not found.");
  return campaign;
}

async function recordActivity(
  scope: CampaignScope,
  campaignId: string,
  activityType: CampaignActivityType,
  summary: string,
  actorUserId: string,
  metadata?: Prisma.InputJsonValue,
) {
  return prisma.campaignActivity.create({
    data: {
      organisationId: scope.organisationId,
      projectId: scope.projectId,
      brandId: scope.brandId,
      campaignId,
      activityType,
      actorUserId,
      summary,
      metadata,
    },
  });
}

async function updateCampaignWithVersion(
  campaignId: string,
  organisationId: string,
  expectedVersion: number,
  data: Prisma.CampaignUpdateInput,
) {
  const result = await prisma.campaign.updateMany({
    where: { id: campaignId, organisationId, version: expectedVersion },
    data: {
      ...data,
      version: { increment: 1 },
    },
  });

  if (result.count === 0) {
    const exists = await prisma.campaign.findFirst({ where: { id: campaignId, organisationId } });
    if (!exists) throw new AppError("NOT_FOUND", "Campaign not found.");
    throw new AppError("CONFLICT", "CAMPAIGN_VERSION_CONFLICT");
  }

  return getCampaignOrThrow(campaignId, organisationId);
}

function buildListWhere(
  organisationId: string,
  filters: CampaignListFilters,
): Prisma.CampaignWhereInput {
  return {
    organisationId,
    ...(filters.brandId ? { brandId: filters.brandId } : {}),
    ...(filters.projectId ? { projectId: filters.projectId } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.lifecycleStage ? { lifecycleStage: filters.lifecycleStage } : {}),
    ...(filters.ownerUserId ? { ownerUserId: filters.ownerUserId } : {}),
    ...(!filters.includeArchived ? { archivedAt: null } : {}),
    ...(filters.search
      ? {
          OR: [
            { name: { contains: filters.search, mode: "insensitive" } },
            { description: { contains: filters.search, mode: "insensitive" } },
          ],
        }
      : {}),
  };
}

export const campaignService = {
  async list(organisationId: string, filters: CampaignListFilters, context: TenantContext) {
    assertOrganisationScope(organisationId, context);
    const limit = filters.limit ?? 25;
    const items = await prisma.campaign.findMany({
      where: buildListWhere(organisationId, filters),
      include: campaignSummaryInclude,
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      ...(filters.cursor ? { cursor: { id: filters.cursor }, skip: 1 } : {}),
    });

    const hasMore = items.length > limit;
    const page = hasMore ? items.slice(0, limit) : items;
    return {
      items: page.map(serializeCampaignSummary),
      nextCursor: hasMore ? page[page.length - 1]?.id ?? null : null,
    };
  },

  async getById(campaignId: string, organisationId: string, context: TenantContext) {
    assertOrganisationScope(organisationId, context);
    const campaign = await getCampaignOrThrow(campaignId, organisationId);
    return serializeCampaignDetail(campaign);
  },

  async create(
    organisationId: string,
    input: CampaignCreateInput,
    context: TenantContext,
    requestId?: string,
  ) {
    assertOrganisationScope(organisationId, context);
    const scope = await resolveBrandScope(input.brandId, organisationId, context);

    const dateIssues = validateCampaignDates(
      input.startAt ? new Date(input.startAt) : null,
      input.endAt ? new Date(input.endAt) : null,
    );
    const budgetIssues = validateBudget(input.budgetAmount, input.budgetCurrency ?? null);
    const issues = [...dateIssues, ...budgetIssues];
    if (issues.length) {
      throw new AppError("VALIDATION_ERROR", formatValidationIssues(issues));
    }

    const ownerUserId = input.ownerUserId ?? context.userProfileId;
    await assertActiveMember(organisationId, ownerUserId);

    const campaign = await prisma.$transaction(async (tx) => {
      const created = await tx.campaign.create({
        data: {
          organisationId: scope.organisationId,
          projectId: scope.projectId,
          brandId: scope.brandId,
          name: input.name,
          description: input.description || undefined,
          status: input.status ?? "DRAFT",
          lifecycleStage: input.lifecycleStage ?? "INTAKE",
          primaryObjective: input.primaryObjective,
          timezone: input.timezone ?? DEFAULT_CAMPAIGN_TIMEZONE,
          startAt: input.startAt ? new Date(input.startAt) : undefined,
          endAt: input.endAt ? new Date(input.endAt) : undefined,
          budgetType: input.budgetType ?? undefined,
          budgetAmount: input.budgetAmount ?? undefined,
          budgetCurrency: input.budgetCurrency?.toUpperCase(),
          strategyNarrative: input.strategyNarrative || undefined,
          strategyTargetOutcomes: input.strategyTargetOutcomes ?? [],
          audienceDescription: input.audienceDescription || undefined,
          audienceSegments: input.audienceSegments ?? [],
          targetAudienceId: input.targetAudienceId ?? undefined,
          ownerUserId,
          createdByUserId: context.userProfileId,
        },
      });

      if (input.channels?.length) {
        await tx.campaignChannel.createMany({
          data: input.channels.map((channel, index) => ({
            organisationId: scope.organisationId,
            campaignId: created.id,
            channelType: channel.channelType,
            name: channel.name || undefined,
            provider: channel.provider || undefined,
            budgetAmount: channel.budgetAmount ?? undefined,
            notes: channel.notes || undefined,
            sortOrder: index,
          })),
        });
      }

      if (input.kpis?.length) {
        await tx.campaignKpi.createMany({
          data: input.kpis.map((kpi, index) => ({
            organisationId: scope.organisationId,
            campaignId: created.id,
            name: kpi.name,
            targetValue: kpi.targetValue ?? undefined,
            unit: kpi.unit || undefined,
            sortOrder: index,
          })),
        });
      }

      const memberIds = new Set(input.memberUserIds ?? []);
      memberIds.add(ownerUserId);
      await Promise.all([...memberIds].map((userId) => assertActiveMember(organisationId, userId)));
      await tx.campaignMember.createMany({
        data: [...memberIds].map((userId) => ({
          campaignId: created.id,
          userId,
          role: userId === ownerUserId ? "OWNER" : "CONTRIBUTOR",
          addedByUserId: context.userProfileId,
        })),
        skipDuplicates: true,
      });

      await recordActivity(
        scope,
        created.id,
        "CREATED",
        `Campaign "${created.name}" created.`,
        context.userProfileId,
      );

      return created;
    });

    await recordAuditEvent({
      organisationId,
      projectId: scope.projectId,
      actorUserId: context.userProfileId,
      action: "campaign.created",
      resourceType: "Campaign",
      resourceId: campaign.id,
      requestId,
    });

    return this.getById(campaign.id, organisationId, context);
  },

  async update(
    campaignId: string,
    organisationId: string,
    input: CampaignUpdateInput,
    context: TenantContext,
    requestId?: string,
  ) {
    assertOrganisationScope(organisationId, context);
    const existing = await getCampaignOrThrow(campaignId, organisationId);
    if (input.version == null) {
      throw new AppError("VALIDATION_ERROR", "Version is required for campaign updates.");
    }

    const dateIssues = validateCampaignDates(
      input.startAt !== undefined
        ? input.startAt
          ? new Date(input.startAt)
          : null
        : existing.startAt,
      input.endAt !== undefined ? (input.endAt ? new Date(input.endAt) : null) : existing.endAt,
    );
    const budgetIssues = validateBudget(
      input.budgetAmount !== undefined ? input.budgetAmount : existing.budgetAmount?.toNumber(),
      input.budgetCurrency !== undefined
        ? input.budgetCurrency
        : existing.budgetCurrency,
    );
    const issues = [...dateIssues, ...budgetIssues];
    if (issues.length) {
      throw new AppError("VALIDATION_ERROR", formatValidationIssues(issues));
    }

    if (input.ownerUserId) {
      await assertActiveMember(organisationId, input.ownerUserId);
    }

    const data: Prisma.CampaignUpdateInput = {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description || null } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.lifecycleStage !== undefined ? { lifecycleStage: input.lifecycleStage } : {}),
      ...(input.primaryObjective !== undefined ? { primaryObjective: input.primaryObjective } : {}),
      ...(input.timezone !== undefined ? { timezone: input.timezone } : {}),
      ...(input.startAt !== undefined
        ? { startAt: input.startAt ? new Date(input.startAt) : null }
        : {}),
      ...(input.endAt !== undefined ? { endAt: input.endAt ? new Date(input.endAt) : null } : {}),
      ...(input.budgetType !== undefined ? { budgetType: input.budgetType } : {}),
      ...(input.budgetAmount !== undefined ? { budgetAmount: input.budgetAmount } : {}),
      ...(input.budgetCurrency !== undefined
        ? { budgetCurrency: input.budgetCurrency?.toUpperCase() ?? null }
        : {}),
      ...(input.strategyNarrative !== undefined
        ? { strategyNarrative: input.strategyNarrative || null }
        : {}),
      ...(input.strategyTargetOutcomes !== undefined
        ? { strategyTargetOutcomes: input.strategyTargetOutcomes }
        : {}),
      ...(input.audienceDescription !== undefined
        ? { audienceDescription: input.audienceDescription || null }
        : {}),
      ...(input.audienceSegments !== undefined
        ? { audienceSegments: input.audienceSegments }
        : {}),
      ...(input.targetAudienceId !== undefined
        ? { targetAudienceId: input.targetAudienceId }
        : {}),
      ...(input.ownerUserId !== undefined ? { ownerUserId: input.ownerUserId } : {}),
    };

    await updateCampaignWithVersion(campaignId, organisationId, input.version, data);

    const scope: CampaignScope = {
      organisationId,
      projectId: existing.projectId,
      brandId: existing.brandId,
    };
    await recordActivity(
      scope,
      campaignId,
      "UPDATED",
      `Campaign "${existing.name}" updated.`,
      context.userProfileId,
    );

    await recordAuditEvent({
      organisationId,
      projectId: existing.projectId,
      actorUserId: context.userProfileId,
      action: "campaign.updated",
      resourceType: "Campaign",
      resourceId: campaignId,
      requestId,
    });

    return this.getById(campaignId, organisationId, context);
  },

  async transition(
    campaignId: string,
    organisationId: string,
    input: CampaignTransitionInput,
    context: TenantContext,
    requestId?: string,
  ) {
    assertOrganisationScope(organisationId, context);
    const existing = await getCampaignOrThrow(campaignId, organisationId);
    const action = input.action as CampaignTransitionAction;

    if (action === "markReady") {
      const readinessIssues = validateReadiness(existing);
      if (readinessIssues.length) {
        throw new AppError("VALIDATION_ERROR", formatValidationIssues(readinessIssues));
      }
    }

    if (action === "activate") {
      const activationIssues = validateActivation(existing);
      if (activationIssues.length) {
        throw new AppError("VALIDATION_ERROR", formatValidationIssues(activationIssues));
      }

      await entitlementService.assert({
        workspaceId: organisationId,
        organisationId,
        entitlement: ENTITLEMENT_KEYS.CAMPAIGNS_MAX_ACTIVE,
        requestedAmount: 1,
      });
    }

    const nextStatus = resolveTransitionAction(action, existing.status);
    const data: Prisma.CampaignUpdateInput = { status: nextStatus };

    if (action === "archive") {
      data.archivedAt = new Date();
    }
    if (action === "restore") {
      data.archivedAt = null;
    }

    await updateCampaignWithVersion(campaignId, organisationId, input.version, data);

    const scope: CampaignScope = {
      organisationId,
      projectId: existing.projectId,
      brandId: existing.brandId,
    };
    const activityType: CampaignActivityType =
      action === "archive" ? "ARCHIVED" : action === "restore" ? "RESTORED" : "STATUS_TRANSITION";

    await recordActivity(
      scope,
      campaignId,
      activityType,
      `Campaign transitioned via ${action} from ${existing.status} to ${nextStatus}.`,
      context.userProfileId,
      { action, fromStatus: existing.status, toStatus: nextStatus },
    );

    await recordAuditEvent({
      organisationId,
      projectId: existing.projectId,
      actorUserId: context.userProfileId,
      action: `campaign.${action}`,
      resourceType: "Campaign",
      resourceId: campaignId,
      requestId,
      metadata: { fromStatus: existing.status, toStatus: nextStatus },
    });

    return this.getById(campaignId, organisationId, context);
  },

  async archive(
    campaignId: string,
    organisationId: string,
    version: number,
    context: TenantContext,
    requestId?: string,
  ) {
    return this.transition(
      campaignId,
      organisationId,
      { action: "archive", version },
      context,
      requestId,
    );
  },

  async restore(
    campaignId: string,
    organisationId: string,
    version: number,
    context: TenantContext,
    requestId?: string,
  ) {
    return this.transition(
      campaignId,
      organisationId,
      { action: "restore", version },
      context,
      requestId,
    );
  },

  async listChannels(campaignId: string, organisationId: string, context: TenantContext) {
    assertOrganisationScope(organisationId, context);
    await getCampaignOrThrow(campaignId, organisationId);
    const channels = await prisma.campaignChannel.findMany({
      where: { campaignId, organisationId },
      orderBy: { sortOrder: "asc" },
    });
    return channels.map(serializeCampaignChannel);
  },

  async addChannel(
    campaignId: string,
    organisationId: string,
    input: CampaignChannelCreateInput,
    context: TenantContext,
    requestId?: string,
  ) {
    assertOrganisationScope(organisationId, context);
    const campaign = await getCampaignOrThrow(campaignId, organisationId);
    const budgetIssues = validateBudget(input.budgetAmount, input.budgetCurrency ?? null);
    if (budgetIssues.length) {
      throw new AppError("VALIDATION_ERROR", formatValidationIssues(budgetIssues));
    }

    const channel = await prisma.campaignChannel.create({
      data: {
        organisationId,
        campaignId,
        channelType: input.channelType,
        status: input.status ?? "PLANNED",
        name: input.name || undefined,
        provider: input.provider || undefined,
        budgetAmount: input.budgetAmount ?? undefined,
        budgetCurrency: input.budgetCurrency?.toUpperCase(),
        notes: input.notes || undefined,
        startAt: input.startAt ? new Date(input.startAt) : undefined,
        endAt: input.endAt ? new Date(input.endAt) : undefined,
        externalRef: input.externalRef || undefined,
        metadata: input.metadata as Prisma.InputJsonValue | undefined,
        sortOrder: input.sortOrder ?? 0,
      },
    });

    await prisma.campaign.update({
      where: { id: campaignId },
      data: { version: { increment: 1 } },
    });

    const scope: CampaignScope = {
      organisationId,
      projectId: campaign.projectId,
      brandId: campaign.brandId,
    };
    await recordActivity(
      scope,
      campaignId,
      "CHANNEL_ADDED",
      `Channel ${channel.channelType} added.`,
      context.userProfileId,
      { channelId: channel.id },
    );

    await recordAuditEvent({
      organisationId,
      projectId: campaign.projectId,
      actorUserId: context.userProfileId,
      action: "campaign.channel.added",
      resourceType: "CampaignChannel",
      resourceId: channel.id,
      requestId,
    });

    return serializeCampaignChannel(channel);
  },

  async updateChannel(
    campaignId: string,
    channelId: string,
    organisationId: string,
    input: CampaignChannelUpdateInput,
    context: TenantContext,
    requestId?: string,
  ) {
    assertOrganisationScope(organisationId, context);
    const campaign = await getCampaignOrThrow(campaignId, organisationId);
    const existing = await prisma.campaignChannel.findFirst({
      where: { id: channelId, campaignId, organisationId },
    });
    if (!existing) throw new AppError("NOT_FOUND", "Campaign channel not found.");

    const budgetIssues = validateBudget(
      input.budgetAmount !== undefined ? input.budgetAmount : existing.budgetAmount?.toNumber(),
      input.budgetCurrency !== undefined ? input.budgetCurrency : existing.budgetCurrency,
    );
    if (budgetIssues.length) {
      throw new AppError("VALIDATION_ERROR", formatValidationIssues(budgetIssues));
    }

    const channel = await prisma.campaignChannel.update({
      where: { id: channelId },
      data: {
        ...(input.channelType !== undefined ? { channelType: input.channelType } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.name !== undefined ? { name: input.name || null } : {}),
        ...(input.provider !== undefined ? { provider: input.provider || null } : {}),
        ...(input.budgetAmount !== undefined ? { budgetAmount: input.budgetAmount } : {}),
        ...(input.budgetCurrency !== undefined
          ? { budgetCurrency: input.budgetCurrency?.toUpperCase() ?? null }
          : {}),
        ...(input.notes !== undefined ? { notes: input.notes || null } : {}),
        ...(input.startAt !== undefined
          ? { startAt: input.startAt ? new Date(input.startAt) : null }
          : {}),
        ...(input.endAt !== undefined ? { endAt: input.endAt ? new Date(input.endAt) : null } : {}),
        ...(input.externalRef !== undefined ? { externalRef: input.externalRef || null } : {}),
        ...(input.metadata !== undefined
          ? { metadata: input.metadata as Prisma.InputJsonValue }
          : {}),
        ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
      },
    });

    await prisma.campaign.update({
      where: { id: campaignId },
      data: { version: { increment: 1 } },
    });

    const scope: CampaignScope = {
      organisationId,
      projectId: campaign.projectId,
      brandId: campaign.brandId,
    };
    await recordActivity(
      scope,
      campaignId,
      "CHANNEL_UPDATED",
      `Channel ${channel.channelType} updated.`,
      context.userProfileId,
      { channelId },
    );

    await recordAuditEvent({
      organisationId,
      projectId: campaign.projectId,
      actorUserId: context.userProfileId,
      action: "campaign.channel.updated",
      resourceType: "CampaignChannel",
      resourceId: channelId,
      requestId,
    });

    return serializeCampaignChannel(channel);
  },

  async removeChannel(
    campaignId: string,
    channelId: string,
    organisationId: string,
    context: TenantContext,
    requestId?: string,
  ) {
    assertOrganisationScope(organisationId, context);
    const campaign = await getCampaignOrThrow(campaignId, organisationId);
    const existing = await prisma.campaignChannel.findFirst({
      where: { id: channelId, campaignId, organisationId },
    });
    if (!existing) throw new AppError("NOT_FOUND", "Campaign channel not found.");

    await prisma.campaignChannel.delete({ where: { id: channelId } });
    await prisma.campaign.update({
      where: { id: campaignId },
      data: { version: { increment: 1 } },
    });

    const scope: CampaignScope = {
      organisationId,
      projectId: campaign.projectId,
      brandId: campaign.brandId,
    };
    await recordActivity(
      scope,
      campaignId,
      "CHANNEL_REMOVED",
      `Channel ${existing.channelType} removed.`,
      context.userProfileId,
      { channelId },
    );

    await recordAuditEvent({
      organisationId,
      projectId: campaign.projectId,
      actorUserId: context.userProfileId,
      action: "campaign.channel.removed",
      resourceType: "CampaignChannel",
      resourceId: channelId,
      requestId,
    });
  },

  async listKpis(campaignId: string, organisationId: string, context: TenantContext) {
    assertOrganisationScope(organisationId, context);
    await getCampaignOrThrow(campaignId, organisationId);
    const kpis = await prisma.campaignKpi.findMany({
      where: { campaignId, organisationId },
      orderBy: { sortOrder: "asc" },
    });
    return kpis.map(serializeCampaignKpi);
  },

  async addKpi(
    campaignId: string,
    organisationId: string,
    input: CampaignKpiCreateInput,
    context: TenantContext,
    requestId?: string,
  ) {
    assertOrganisationScope(organisationId, context);
    const campaign = await getCampaignOrThrow(campaignId, organisationId);
    const kpi = await prisma.campaignKpi.create({
      data: {
        organisationId,
        campaignId,
        name: input.name,
        metricKey: input.metricKey || undefined,
        targetValue: input.targetValue ?? undefined,
        currentValue: input.currentValue ?? undefined,
        unit: input.unit || undefined,
        sourceType: input.sourceType ?? "MANUAL",
        sourceRef: input.sourceRef || undefined,
        sortOrder: input.sortOrder ?? 0,
      },
    });

    await prisma.campaign.update({
      where: { id: campaignId },
      data: { version: { increment: 1 } },
    });

    const scope: CampaignScope = {
      organisationId,
      projectId: campaign.projectId,
      brandId: campaign.brandId,
    };
    await recordActivity(
      scope,
      campaignId,
      "KPI_ADDED",
      `KPI "${kpi.name}" added.`,
      context.userProfileId,
      { kpiId: kpi.id },
    );

    await recordAuditEvent({
      organisationId,
      projectId: campaign.projectId,
      actorUserId: context.userProfileId,
      action: "campaign.kpi.added",
      resourceType: "CampaignKpi",
      resourceId: kpi.id,
      requestId,
    });

    return serializeCampaignKpi(kpi);
  },

  async updateKpi(
    campaignId: string,
    kpiId: string,
    organisationId: string,
    input: CampaignKpiUpdateInput,
    context: TenantContext,
    requestId?: string,
  ) {
    assertOrganisationScope(organisationId, context);
    const campaign = await getCampaignOrThrow(campaignId, organisationId);
    const existing = await prisma.campaignKpi.findFirst({
      where: { id: kpiId, campaignId, organisationId },
    });
    if (!existing) throw new AppError("NOT_FOUND", "Campaign KPI not found.");

    const kpi = await prisma.campaignKpi.update({
      where: { id: kpiId },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.metricKey !== undefined ? { metricKey: input.metricKey || null } : {}),
        ...(input.targetValue !== undefined ? { targetValue: input.targetValue } : {}),
        ...(input.currentValue !== undefined ? { currentValue: input.currentValue } : {}),
        ...(input.unit !== undefined ? { unit: input.unit || null } : {}),
        ...(input.sourceType !== undefined ? { sourceType: input.sourceType } : {}),
        ...(input.sourceRef !== undefined ? { sourceRef: input.sourceRef || null } : {}),
        ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
      },
    });

    await prisma.campaign.update({
      where: { id: campaignId },
      data: { version: { increment: 1 } },
    });

    const scope: CampaignScope = {
      organisationId,
      projectId: campaign.projectId,
      brandId: campaign.brandId,
    };
    await recordActivity(
      scope,
      campaignId,
      "KPI_UPDATED",
      `KPI "${kpi.name}" updated.`,
      context.userProfileId,
      { kpiId },
    );

    await recordAuditEvent({
      organisationId,
      projectId: campaign.projectId,
      actorUserId: context.userProfileId,
      action: "campaign.kpi.updated",
      resourceType: "CampaignKpi",
      resourceId: kpiId,
      requestId,
    });

    return serializeCampaignKpi(kpi);
  },

  async removeKpi(
    campaignId: string,
    kpiId: string,
    organisationId: string,
    context: TenantContext,
    requestId?: string,
  ) {
    assertOrganisationScope(organisationId, context);
    const campaign = await getCampaignOrThrow(campaignId, organisationId);
    const existing = await prisma.campaignKpi.findFirst({
      where: { id: kpiId, campaignId, organisationId },
    });
    if (!existing) throw new AppError("NOT_FOUND", "Campaign KPI not found.");

    await prisma.campaignKpi.delete({ where: { id: kpiId } });
    await prisma.campaign.update({
      where: { id: campaignId },
      data: { version: { increment: 1 } },
    });

    const scope: CampaignScope = {
      organisationId,
      projectId: campaign.projectId,
      brandId: campaign.brandId,
    };
    await recordActivity(
      scope,
      campaignId,
      "KPI_REMOVED",
      `KPI "${existing.name}" removed.`,
      context.userProfileId,
      { kpiId },
    );

    await recordAuditEvent({
      organisationId,
      projectId: campaign.projectId,
      actorUserId: context.userProfileId,
      action: "campaign.kpi.removed",
      resourceType: "CampaignKpi",
      resourceId: kpiId,
      requestId,
    });
  },

  async listMembers(campaignId: string, organisationId: string, context: TenantContext) {
    assertOrganisationScope(organisationId, context);
    await getCampaignOrThrow(campaignId, organisationId);
    const members = await prisma.campaignMember.findMany({
      where: { campaignId, removedAt: null },
      include: { user: { select: { id: true, displayName: true, email: true } } },
      orderBy: { addedAt: "asc" },
    });
    return members.map(serializeCampaignMember);
  },

  async addMember(
    campaignId: string,
    organisationId: string,
    input: CampaignMemberCreateInput,
    context: TenantContext,
    requestId?: string,
  ) {
    assertOrganisationScope(organisationId, context);
    const campaign = await getCampaignOrThrow(campaignId, organisationId);
    await assertActiveMember(organisationId, input.userId);

    const member = await prisma.campaignMember.upsert({
      where: { campaignId_userId: { campaignId, userId: input.userId } },
      create: {
        campaignId,
        userId: input.userId,
        role: input.role ?? "CONTRIBUTOR",
        addedByUserId: context.userProfileId,
        removedAt: null,
      },
      update: {
        role: input.role ?? "CONTRIBUTOR",
        removedAt: null,
        addedByUserId: context.userProfileId,
      },
      include: { user: { select: { id: true, displayName: true, email: true } } },
    });

    await prisma.campaign.update({
      where: { id: campaignId },
      data: { version: { increment: 1 } },
    });

    const scope: CampaignScope = {
      organisationId,
      projectId: campaign.projectId,
      brandId: campaign.brandId,
    };
    await recordActivity(
      scope,
      campaignId,
      "MEMBER_ADDED",
      `Member ${member.user.email} added.`,
      context.userProfileId,
      { memberId: member.id, userId: member.userId },
    );

    await recordAuditEvent({
      organisationId,
      projectId: campaign.projectId,
      actorUserId: context.userProfileId,
      action: "campaign.member.added",
      resourceType: "CampaignMember",
      resourceId: member.id,
      requestId,
    });

    return serializeCampaignMember(member);
  },

  async updateMember(
    campaignId: string,
    memberId: string,
    organisationId: string,
    input: CampaignMemberUpdateInput,
    context: TenantContext,
    requestId?: string,
  ) {
    assertOrganisationScope(organisationId, context);
    const campaign = await getCampaignOrThrow(campaignId, organisationId);
    const existing = await prisma.campaignMember.findFirst({
      where: { id: memberId, campaignId, removedAt: null },
      include: { user: { select: { id: true, displayName: true, email: true } } },
    });
    if (!existing) throw new AppError("NOT_FOUND", "Campaign member not found.");

    const member = await prisma.campaignMember.update({
      where: { id: memberId },
      data: { role: input.role },
      include: { user: { select: { id: true, displayName: true, email: true } } },
    });

    await prisma.campaign.update({
      where: { id: campaignId },
      data: { version: { increment: 1 } },
    });

    const scope: CampaignScope = {
      organisationId,
      projectId: campaign.projectId,
      brandId: campaign.brandId,
    };
    await recordActivity(
      scope,
      campaignId,
      "MEMBER_UPDATED",
      `Member ${member.user.email} role updated to ${member.role}.`,
      context.userProfileId,
      { memberId },
    );

    await recordAuditEvent({
      organisationId,
      projectId: campaign.projectId,
      actorUserId: context.userProfileId,
      action: "campaign.member.updated",
      resourceType: "CampaignMember",
      resourceId: memberId,
      requestId,
    });

    return serializeCampaignMember(member);
  },

  async removeMember(
    campaignId: string,
    memberId: string,
    organisationId: string,
    context: TenantContext,
    requestId?: string,
  ) {
    assertOrganisationScope(organisationId, context);
    const campaign = await getCampaignOrThrow(campaignId, organisationId);
    const existing = await prisma.campaignMember.findFirst({
      where: { id: memberId, campaignId, removedAt: null },
      include: { user: { select: { id: true, displayName: true, email: true } } },
    });
    if (!existing) throw new AppError("NOT_FOUND", "Campaign member not found.");
    if (existing.role === "OWNER") {
      throw new AppError("VALIDATION_ERROR", "Campaign owner cannot be removed.");
    }

    await prisma.campaignMember.update({
      where: { id: memberId },
      data: { removedAt: new Date() },
    });

    await prisma.campaign.update({
      where: { id: campaignId },
      data: { version: { increment: 1 } },
    });

    const scope: CampaignScope = {
      organisationId,
      projectId: campaign.projectId,
      brandId: campaign.brandId,
    };
    await recordActivity(
      scope,
      campaignId,
      "MEMBER_REMOVED",
      `Member ${existing.user.email} removed.`,
      context.userProfileId,
      { memberId },
    );

    await recordAuditEvent({
      organisationId,
      projectId: campaign.projectId,
      actorUserId: context.userProfileId,
      action: "campaign.member.removed",
      resourceType: "CampaignMember",
      resourceId: memberId,
      requestId,
    });
  },

  async listActivity(
    campaignId: string,
    organisationId: string,
    filters: z.infer<typeof campaignActivityListSchema>,
    context: TenantContext,
  ) {
    assertOrganisationScope(organisationId, context);
    await getCampaignOrThrow(campaignId, organisationId);
    const limit = filters.limit ?? 25;
    const items = await prisma.campaignActivity.findMany({
      where: {
        campaignId,
        organisationId,
        ...(filters.activityType ? { activityType: filters.activityType } : {}),
      },
      include: { actor: { select: { id: true, displayName: true, email: true } } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      ...(filters.cursor ? { cursor: { id: filters.cursor }, skip: 1 } : {}),
    });

    const hasMore = items.length > limit;
    const page = hasMore ? items.slice(0, limit) : items;
    return {
      items: page.map(serializeCampaignActivity),
      nextCursor: hasMore ? page[page.length - 1]?.id ?? null : null,
    };
  },
};
