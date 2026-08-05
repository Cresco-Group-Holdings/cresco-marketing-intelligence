import { prisma } from "@/lib/database/prisma";
import { AGENT_TOOL_KEYS } from "@/lib/agent-platform/constants";
import type { AgentExecutionContext } from "@/lib/agent-platform/agent-context";
import { BrandContextBuilder } from "@/lib/ai/brand-context-builder";
import { AppError } from "@/lib/errors";
import type { TenantContext } from "@/lib/tenancy/context";
import { brandKnowledgeService } from "@/server/services/brand-knowledge-service";

export type ToolExecutionResult = {
  toolKey: string;
  output: Record<string, unknown>;
  limitations: string[];
};

async function getCampaignSummary(context: AgentExecutionContext) {
  if (!context.campaignId) {
    return { campaigns: [], limitations: ["No campaignId provided in run scope."] };
  }

  const campaign = await prisma.campaign.findFirst({
    where: { id: context.campaignId, organisationId: context.organisationId, archivedAt: null },
    include: { kpis: true, channels: true },
  });

  if (!campaign) {
    return { campaigns: [], limitations: ["Campaign not found in tenant scope."] };
  }

  return {
    campaigns: [
      {
        id: campaign.id,
        name: campaign.name,
        status: campaign.status,
        startAt: campaign.startAt?.toISOString() ?? null,
        endAt: campaign.endAt?.toISOString() ?? null,
        kpiCount: campaign.kpis.length,
        channelCount: campaign.channels.length,
      },
    ],
    limitations: [],
  };
}

async function getAnalyticsMetrics(context: AgentExecutionContext) {
  const facts = await prisma.analyticsFact.groupBy({
    by: ["metricKey"],
    where: {
      organisationId: context.organisationId,
      ...(context.brandId ? { brandId: context.brandId } : {}),
      ...(context.campaignId ? { campaignId: context.campaignId } : {}),
    },
    _sum: { value: true },
  });

  if (facts.length === 0) {
    return {
      metrics: {},
      limitations: ["No analytics facts available for the selected scope."],
    };
  }

  const metrics = Object.fromEntries(
    facts.map((row) => [row.metricKey, Number((row._sum.value ?? 0).toString())]),
  );

  return { metrics, limitations: [] };
}

async function getBrandKnowledge(context: AgentExecutionContext, tenant: TenantContext) {
  if (!context.brandId) {
    return { brandContext: null, limitations: ["No brandId provided in run scope."] };
  }

  const snapshot = await brandKnowledgeService.getSnapshot(
    context.brandId,
    context.organisationId,
    tenant,
  );

  const builder = new BrandContextBuilder();
  const controlled = builder.build(snapshot, {});

  return {
    brandContext: controlled,
    limitations:
      controlled.usedRecords.length === 0
        ? ["Brand knowledge is incomplete; recommendations may be limited."]
        : [],
  };
}

async function listContentItems(context: AgentExecutionContext) {
  const items = await prisma.contentItem.findMany({
    where: {
      organisationId: context.organisationId,
      ...(context.brandId ? { brandId: context.brandId } : {}),
      ...(context.projectId ? { projectId: context.projectId } : {}),
      archivedAt: null,
    },
    select: { id: true, title: true, status: true, contentType: true, updatedAt: true },
    orderBy: { updatedAt: "desc" },
    take: 25,
  });

  return {
    items: items.map((item) => ({
      ...item,
      updatedAt: item.updatedAt.toISOString(),
    })),
    limitations: items.length === 0 ? ["No content items found in scope."] : [],
  };
}

async function getLeadSummary(context: AgentExecutionContext) {
  const leads = await prisma.marketingLead.findMany({
    where: {
      organisationId: context.organisationId,
      ...(context.brandId ? { brandId: context.brandId } : {}),
      deletedAt: null,
    },
    select: {
      id: true,
      displayName: true,
      status: true,
      sourceCampaign: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: 25,
  });

  return {
    leads: leads.map((lead) => ({
      id: lead.id,
      displayName: lead.displayName,
      status: lead.status,
      sourceCampaign: lead.sourceCampaign,
      createdAt: lead.createdAt.toISOString(),
    })),
    limitations: leads.length === 0 ? ["No leads found in scope."] : [],
  };
}

async function listCampaignKpis(context: AgentExecutionContext) {
  if (!context.campaignId) {
    return { kpis: [], limitations: ["No campaignId provided in run scope."] };
  }

  const kpis = await prisma.campaignKpi.findMany({
    where: { organisationId: context.organisationId, campaignId: context.campaignId },
    select: {
      id: true,
      name: true,
      metricKey: true,
      targetValue: true,
      currentValue: true,
      unit: true,
    },
  });

  return {
    kpis: kpis.map((kpi) => ({
      ...kpi,
      targetValue: kpi.targetValue ? Number(kpi.targetValue.toString()) : null,
      currentValue: kpi.currentValue ? Number(kpi.currentValue.toString()) : null,
    })),
    limitations: kpis.length === 0 ? ["No KPIs configured for campaign."] : [],
  };
}

const TOOL_HANDLERS: Record<
  string,
  (
    context: AgentExecutionContext,
    tenant: TenantContext,
  ) => Promise<{ output: Record<string, unknown>; limitations: string[] }>
> = {
  [AGENT_TOOL_KEYS.GET_CAMPAIGN_SUMMARY]: async (context) => {
    const result = await getCampaignSummary(context);
    return { output: { campaigns: result.campaigns }, limitations: result.limitations };
  },
  [AGENT_TOOL_KEYS.GET_ANALYTICS_METRICS]: async (context) => {
    const result = await getAnalyticsMetrics(context);
    return { output: { metrics: result.metrics }, limitations: result.limitations };
  },
  [AGENT_TOOL_KEYS.GET_BRAND_KNOWLEDGE]: async (context, tenant) => {
    const result = await getBrandKnowledge(context, tenant);
    return { output: { brandContext: result.brandContext }, limitations: result.limitations };
  },
  [AGENT_TOOL_KEYS.LIST_CONTENT_ITEMS]: async (context) => {
    const result = await listContentItems(context);
    return { output: { items: result.items }, limitations: result.limitations };
  },
  [AGENT_TOOL_KEYS.GET_LEAD_SUMMARY]: async (context) => {
    const result = await getLeadSummary(context);
    return { output: { leads: result.leads }, limitations: result.limitations };
  },
  [AGENT_TOOL_KEYS.LIST_CAMPAIGN_KPIS]: async (context) => {
    const result = await listCampaignKpis(context);
    return { output: { kpis: result.kpis }, limitations: result.limitations };
  },
};

export async function executeAgentTool(
  toolKey: string,
  context: AgentExecutionContext,
  tenant: TenantContext,
): Promise<ToolExecutionResult> {
  const handler = TOOL_HANDLERS[toolKey];
  if (!handler) {
    throw new AppError("VALIDATION_ERROR", `Unknown agent tool: ${toolKey}`);
  }

  const { output, limitations } = await handler(context, tenant);
  return { toolKey, output, limitations };
}
