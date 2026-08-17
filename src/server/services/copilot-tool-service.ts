import type { TenantContext } from "@/lib/tenancy/context";
import { detectAnomalies } from "@/lib/analyst/anomaly-detection";
import { createEvidence, formatCurrency, formatMultiplier, formatPercent } from "@/lib/copilot/format";
import type { CopilotToolContext, CopilotToolExecutor } from "@/lib/copilot/tools/registry";
import type { CopilotToolResult } from "@/lib/copilot/types";
import { attributionDashboardService } from "@/server/services/attribution-dashboard-service";
import { executiveDashboardService } from "@/server/services/executive-dashboard-service";
import { paidAdsDashboardService } from "@/server/services/paid-ads-dashboard-service";
import { revenueDashboardService } from "@/server/services/revenue-dashboard-service";
import { socialAnalyticsQueryService } from "@/server/services/social-analytics-query-service";
import { prisma } from "@/lib/database/prisma";

const TOP_N = 10;

function roas(revenue: number, spend: number): number | null {
  return spend > 0 ? revenue / spend : null;
}

export function createCopilotToolExecutors(tenant: TenantContext): Record<string, CopilotToolExecutor> {
  const scope = async (context: CopilotToolContext) => {
    const { brandId, organisationId } = context;
    return { brandId, organisationId, tenant, context };
  };

  return {
    getMarketingOverview: async (context) => {
      const { brandId, organisationId, tenant, context: ctx } = await scope(context);
      const overview = await executiveDashboardService.getOverview(
        brandId,
        organisationId,
        ctx.from,
        ctx.to,
        "PREVIOUS_PERIOD",
        tenant,
      );
      const evidence = Object.entries(overview.kpis).slice(0, 12).map(([key, kpi]) =>
        createEvidence({
          label: key,
          metric: key,
          value: kpi.available && kpi.value != null ? kpi.value : "Unavailable",
          previousValue:
            kpi.previous.available && kpi.previous.value != null ? kpi.previous.value : undefined,
          source: kpi.source ?? "Executive dashboard",
          dateRange: { from: ctx.from.toISOString(), to: ctx.to.toISOString() },
          coverage: kpi.available ? 100 : 0,
        }),
      );
      const anomalies = detectAnomalies(overview.kpis);
      return {
        data: { overview, anomalies },
        evidence,
        coverage: evidence.filter((item) => item.value !== "Unavailable").length / Math.max(evidence.length, 1) * 100,
        limitations: [],
      } satisfies CopilotToolResult;
    },

    getPaidPerformance: async (context) => {
      const { brandId, organisationId, tenant, context: ctx } = await scope(context);
      const [current, previous] = await Promise.all([
        paidAdsDashboardService.getOverview(brandId, organisationId, ctx.from, ctx.to, tenant),
        paidAdsDashboardService.getOverview(
          brandId,
          organisationId,
          ctx.comparisonFrom,
          ctx.comparisonTo,
          tenant,
        ),
      ]);

      const currentRoas = roas(0, current.spend);
      const previousRoas = roas(0, previous.spend);

      const evidence = [
        createEvidence({
          label: "Paid spend",
          metric: "spend",
          value: formatCurrency(current.spend),
          previousValue: formatCurrency(previous.spend),
          source: "MarketingCostRecord",
        }),
        createEvidence({
          label: "Paid conversions",
          metric: "conversions",
          value: current.conversions,
          previousValue: previous.conversions,
          source: "Provider metrics",
        }),
        createEvidence({
          label: "CTR",
          metric: "ctr",
          value: `${(current.ctr * 100).toFixed(2)}%`,
          previousValue: `${(previous.ctr * 100).toFixed(2)}%`,
          source: "Provider metrics",
        }),
      ];

      return {
        data: { current, previous, currentRoas, previousRoas },
        evidence,
        limitations: [current.roasDisclaimer],
      };
    },

    getCampaignPerformance: async (context) => {
      const { brandId, organisationId, tenant, context: ctx } = await scope(context);
      const campaigns = await paidAdsDashboardService.getCampaigns(
        brandId,
        organisationId,
        ctx.from,
        ctx.to,
        tenant,
      );
      const top = campaigns
        .sort((a, b) => b.spend - a.spend)
        .slice(0, context.limit ?? TOP_N);
      const evidence = top.map((campaign) =>
        createEvidence({
          label: campaign.name,
          metric: "spend",
          value: formatCurrency(campaign.spend),
          source: campaign.provider,
          entityType: "campaign",
          entityId: campaign.id,
          entityHref: `/advertising/campaigns/${campaign.id}`,
          sampleSize: campaign.clicks,
        }),
      );
      return {
        data: { campaigns: top },
        evidence,
        truncated: campaigns.length > top.length,
        sampleSize: top.length,
      };
    },

    getCreativePerformance: async (context) => {
      const { brandId, organisationId, tenant } = await scope(context);
      const creatives = await paidAdsDashboardService.getCreatives(brandId, organisationId, tenant);
      const evidence = creatives.slice(0, context.limit ?? TOP_N).map((creative) =>
        createEvidence({
          label: creative.name ?? creative.providerCreativeId,
          source: creative.provider,
          entityType: "creative",
          entityId: creative.id,
          entityHref: `/advertising/creatives/${creative.id}`,
        }),
      );
      return { data: { creatives: creatives.slice(0, TOP_N) }, evidence, truncated: creatives.length > TOP_N };
    },

    getOrganicPerformance: async (context) => {
      const { brandId, organisationId, tenant, context: ctx } = await scope(context);
      const overview = await socialAnalyticsQueryService.overview(
        brandId,
        organisationId,
        { from: ctx.from, to: ctx.to },
        tenant,
      );
      const evidence = [
        createEvidence({
          label: "Organic reach",
          metric: "reach",
          value: overview.totals.reach ?? 0,
          source: "Social analytics",
        }),
        createEvidence({
          label: "Engagement rate",
          metric: "engagementRate",
          value:
            overview.derived.engagementRate != null
              ? `${overview.derived.engagementRate.toFixed(2)}%`
              : "Unavailable",
          source: "Social analytics",
        }),
      ];
      return { data: overview, evidence };
    },

    getContentPerformance: async (context) => {
      const { brandId, organisationId, tenant, context: ctx } = await scope(context);
      const attribution = await socialAnalyticsQueryService.attribution(
        brandId,
        organisationId,
        { from: ctx.from, to: ctx.to },
        "CONTENT_ITEM",
        tenant,
      );
      const groups = attribution.groups.slice(0, context.limit ?? TOP_N);
      const evidence = groups.map((group) =>
        createEvidence({
          label: group.label,
          metric: "impressions",
          value: group.totals.impressions ?? 0,
          entityType: "content",
          entityId: group.key,
          entityHref: `/content/studio/${group.key}`,
          source: group.providers.join(", "),
        }),
      );
      return {
        data: { content: groups },
        evidence,
        truncated: attribution.groups.length > groups.length,
        sampleSize: groups.length,
      };
    },

    getPublishingSchedule: async (context) => {
      const { brandId, organisationId, tenant, context: ctx } = await scope(context);
      const scheduled = await prisma.contentSchedule.count({
        where: {
          brandId,
          organisationId,
          status: "QUEUED",
          scheduledFor: { gte: new Date(), lte: new Date(Date.now() + 14 * 86_400_000) },
        },
      });
      const published = await prisma.contentSchedule.count({
        where: {
          brandId,
          organisationId,
          status: "COMPLETED",
          scheduledFor: { gte: ctx.from, lte: ctx.to },
        },
      });
      const evidence = [
        createEvidence({
          label: "Scheduled upcoming (14d)",
          value: scheduled,
          source: "Publishing queue",
        }),
        createEvidence({
          label: "Published in period",
          value: published,
          source: "Publishing queue",
        }),
      ];
      return { data: { scheduled, published }, evidence };
    },

    getAttributionSummary: async (context) => {
      const { brandId, organisationId, tenant, context: ctx } = await scope(context);
      const overview = await attributionDashboardService.getOverview(
        brandId,
        organisationId,
        ctx.from,
        ctx.to,
        tenant,
      );
      const evidence = overview.channelBreakdown.slice(0, TOP_N).map((row) =>
        createEvidence({
          label: row.channel,
          metric: "attributedRevenue",
          value: formatCurrency(row.creditValue),
          source: `Attribution (${ctx.attributionModel ?? "default model"})`,
          sampleSize: row.conversions,
        }),
      );
      const coverage =
        overview.attributedRevenue > 0
          ? Math.min(100, (overview.attributedConversions / Math.max(overview.attributedConversions + overview.unattributedConversions, 1)) * 100)
          : null;
      return {
        data: overview,
        evidence,
        coverage,
        limitations: overview.limitations,
        sampleSize: overview.attributedConversions + overview.unattributedConversions,
      };
    },

    getRevenueAnalytics: async (context) => {
      const { brandId, organisationId, tenant, context: ctx } = await scope(context);
      const overview = await revenueDashboardService.getOverview(
        brandId,
        organisationId,
        ctx.from,
        ctx.to,
        tenant,
      );
      const evidence = [
        createEvidence({
          label: "Observed revenue",
          metric: "totalRevenue",
          value: formatCurrency(overview.metrics.totalRevenue),
          source: "Revenue transactions",
        }),
        createEvidence({
          label: "Net revenue",
          metric: "netRevenue",
          value: formatCurrency(overview.metrics.netRevenue),
          source: "Revenue transactions",
        }),
      ];
      return { data: overview.metrics, evidence };
    },

    getDataCoverage: async (context) => {
      const { brandId, organisationId, tenant } = await scope(context);
      const health = await executiveDashboardService
        .getDataHealth(brandId, organisationId, tenant)
        .catch(() => null);
      const warnings = await executiveDashboardService
        .getWarnings(brandId, organisationId, context.from, context.to, tenant)
        .catch(() => ({ warnings: [] }));
      const evidence = (warnings.warnings ?? []).map((warning, index) =>
        createEvidence({
          id: `coverage-${index}`,
          label: warning.message,
          source: "Data health",
          freshness: health ? "fresh" : "unavailable",
        }),
      );
      return {
        data: { health, warnings: warnings.warnings },
        evidence,
        limitations: warnings.warnings?.map((warning) => warning.message) ?? [],
      };
    },

    getMarketingSignals: async (context) => {
      const { brandId, organisationId, tenant, context: ctx } = await scope(context);
      const overview = await executiveDashboardService.getOverview(
        brandId,
        organisationId,
        ctx.from,
        ctx.to,
        "PREVIOUS_PERIOD",
        tenant,
      );
      const anomalies = detectAnomalies(overview.kpis);
      const evidence = anomalies.slice(0, 5).map((anomaly) =>
        createEvidence({
          label: anomaly.metricKey,
          metric: anomaly.metricKey,
          value: formatPercent(anomaly.changePercent),
          previousValue: anomaly.previousValue,
          source: "Deterministic anomaly detection",
          sampleSize: anomaly.sampleSize,
        }),
      );
      return { data: { anomalies }, evidence, sampleSize: anomalies.length };
    },
  };
}
