import type {
  Campaign,
  CampaignActivity,
  CampaignChannel,
  CampaignKpi,
  CampaignMember,
  UserProfile,
} from "@prisma/client";

type OwnerSelect = Pick<UserProfile, "id" | "displayName" | "email">;

function serializeOwner(user: OwnerSelect) {
  return {
    id: user.id,
    displayName: user.displayName,
    email: user.email,
  };
}

function decimalToNumber(value: { toNumber(): number } | null | undefined): number | null {
  return value == null ? null : value.toNumber();
}

export function serializeCampaignChannel(channel: CampaignChannel) {
  return {
    id: channel.id,
    channelType: channel.channelType,
    status: channel.status,
    name: channel.name,
    provider: channel.provider,
    budgetAmount: decimalToNumber(channel.budgetAmount),
    budgetCurrency: channel.budgetCurrency,
    notes: channel.notes,
    startAt: channel.startAt?.toISOString() ?? null,
    endAt: channel.endAt?.toISOString() ?? null,
    externalRef: channel.externalRef,
    sortOrder: channel.sortOrder,
    createdAt: channel.createdAt.toISOString(),
    updatedAt: channel.updatedAt.toISOString(),
  };
}

export function serializeCampaignKpi(kpi: CampaignKpi) {
  return {
    id: kpi.id,
    name: kpi.name,
    metricKey: kpi.metricKey,
    targetValue: decimalToNumber(kpi.targetValue),
    currentValue: decimalToNumber(kpi.currentValue),
    unit: kpi.unit,
    sourceType: kpi.sourceType,
    sourceRef: kpi.sourceRef,
    sortOrder: kpi.sortOrder,
    createdAt: kpi.createdAt.toISOString(),
    updatedAt: kpi.updatedAt.toISOString(),
  };
}

export function serializeCampaignMember(
  member: CampaignMember & { user: OwnerSelect },
) {
  return {
    id: member.id,
    role: member.role,
    addedAt: member.addedAt.toISOString(),
    removedAt: member.removedAt?.toISOString() ?? null,
    user: serializeOwner(member.user),
  };
}

export function serializeCampaignActivity(
  activity: CampaignActivity & { actor: OwnerSelect },
) {
  return {
    id: activity.id,
    activityType: activity.activityType,
    summary: activity.summary,
    metadata: activity.metadata,
    createdAt: activity.createdAt.toISOString(),
    actor: serializeOwner(activity.actor),
  };
}

export function serializeCampaignSummary(
  campaign: Campaign & {
    owner?: OwnerSelect;
    brand?: { name: string } | null;
    _count?: { channels: number; kpis: number; members: number };
  },
) {
  return {
    id: campaign.id,
    workspaceId: campaign.organisationId,
    organisationId: campaign.organisationId,
    projectId: campaign.projectId,
    brandId: campaign.brandId,
    brandName: campaign.brand?.name ?? null,
    name: campaign.name,
    description: campaign.description,
    status: campaign.status,
    lifecycleStage: campaign.lifecycleStage,
    primaryObjective: campaign.primaryObjective,
    timezone: campaign.timezone,
    startAt: campaign.startAt?.toISOString() ?? null,
    endAt: campaign.endAt?.toISOString() ?? null,
    budgetType: campaign.budgetType,
    budgetAmount: decimalToNumber(campaign.budgetAmount),
    budgetCurrency: campaign.budgetCurrency,
    version: campaign.version,
    archivedAt: campaign.archivedAt?.toISOString() ?? null,
    createdAt: campaign.createdAt.toISOString(),
    updatedAt: campaign.updatedAt.toISOString(),
    owner: campaign.owner ? serializeOwner(campaign.owner) : undefined,
    channelCount: campaign._count?.channels,
    kpiCount: campaign._count?.kpis,
    memberCount: campaign._count?.members,
  };
}

export function serializeCampaignDetail(
  campaign: Campaign & {
    owner: OwnerSelect;
    brand: { name: string };
    channels: CampaignChannel[];
    kpis: CampaignKpi[];
    members: Array<CampaignMember & { user: OwnerSelect }>;
    activities?: Array<CampaignActivity & { actor: OwnerSelect }>;
  },
) {
  return {
    ...serializeCampaignSummary(campaign),
    strategy: {
      narrative: campaign.strategyNarrative,
      targetOutcomes: campaign.strategyTargetOutcomes,
    },
    audience: {
      description: campaign.audienceDescription,
      segments: campaign.audienceSegments,
      targetAudienceId: campaign.targetAudienceId,
    },
    channels: campaign.channels.map(serializeCampaignChannel),
    kpis: campaign.kpis.map(serializeCampaignKpi),
    members: campaign.members.map(serializeCampaignMember),
    activities: campaign.activities?.map(serializeCampaignActivity),
  };
}
