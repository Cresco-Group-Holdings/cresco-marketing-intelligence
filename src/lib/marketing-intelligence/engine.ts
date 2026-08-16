import type { MarketingIntelligenceContext, MarketingSignal, MarketingSignalRule } from "@/lib/marketing-intelligence/types";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPct(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

const budgetOpportunityRule: MarketingSignalRule = {
  id: "budget-opportunity",
  evaluate(context) {
    if (context.paid.byProvider.length < 2 || context.paid.spend <= 0) {
      return null;
    }

    const withRoas = context.paid.byProvider
      .map((provider) => ({
        ...provider,
        roas: provider.spend > 0 ? provider.revenue / provider.spend : 0,
        spendShare: provider.spend / context.paid.spend,
      }))
      .filter((provider) => provider.spend > 0);

    if (withRoas.length < 2) {
      return null;
    }

    const averageRoas = context.paid.roas ?? 0;
    const leader = [...withRoas].sort((a, b) => b.roas - a.roas)[0];
    if (!leader || averageRoas <= 0 || leader.roas <= averageRoas * 1.15) {
      return null;
    }

    const uplift = ((leader.roas - averageRoas) / averageRoas) * 100;

    return {
      id: `budget-opportunity-${leader.provider}`,
      type: "budget",
      severity: uplift >= 30 ? "high" : "medium",
      title: `${leader.provider} ROAS outperforms paid average`,
      explanation: `${leader.provider} generated a ${leader.roas.toFixed(2)}x ROAS during ${context.rangeLabel.toLowerCase()} versus a ${averageRoas.toFixed(2)}x paid-channel average, while using ${(leader.spendShare * 100).toFixed(0)}% of total paid spend.`,
      evidence: [
        { label: "Channel ROAS", value: `${leader.roas.toFixed(2)}x` },
        { label: "Paid average ROAS", value: `${averageRoas.toFixed(2)}x` },
        { label: "Spend share", value: `${(leader.spendShare * 100).toFixed(0)}%` },
      ],
      estimatedImpact: `Potential ${formatPct(uplift)} ROAS uplift if budget is rebalanced`,
      action: { label: "Adjust Budget", href: "/advertising/budgets" },
      category: "paid",
      generatedAt: new Date().toISOString(),
      confidence: 0.82,
    };
  },
};

const cpaAnomalyRule: MarketingSignalRule = {
  id: "cpa-anomaly",
  evaluate(context) {
    if (context.paid.cpa == null || context.paid.previousCpa == null || context.paid.previousCpa <= 0) {
      return null;
    }

    const change = ((context.paid.cpa - context.paid.previousCpa) / context.paid.previousCpa) * 100;
    if (change < 20) {
      return null;
    }

    return {
      id: "cpa-anomaly",
      type: "anomaly",
      severity: change >= 40 ? "high" : "medium",
      title: "Paid CPA increased materially",
      explanation: `Average CPA rose from ${formatCurrency(context.paid.previousCpa)} to ${formatCurrency(context.paid.cpa)} (${formatPct(change)}) during ${context.rangeLabel.toLowerCase()}.`,
      evidence: [
        { label: "Current CPA", value: formatCurrency(context.paid.cpa) },
        { label: "Previous CPA", value: formatCurrency(context.paid.previousCpa) },
        { label: "Conversions", value: String(context.paid.conversions) },
      ],
      estimatedImpact: "Investigate conversion efficiency before increasing spend",
      action: { label: "Investigate", href: "/analytics/advertising" },
      category: "paid",
      generatedAt: new Date().toISOString(),
      confidence: 0.9,
    };
  },
};

const organicOpportunityRule: MarketingSignalRule = {
  id: "organic-opportunity",
  evaluate(context) {
    const leader = [...context.organic.channels]
      .filter((channel) => channel.connected && channel.engagementRate != null)
      .sort((a, b) => (b.engagementRate ?? 0) - (a.engagementRate ?? 0))[0];

    if (!leader || (leader.engagementRate ?? 0) < 2) {
      return null;
    }

    const averageEngagementRate =
      context.organic.engagementRate ??
      context.organic.channels
        .filter((channel) => channel.engagementRate != null)
        .reduce((sum, channel) => sum + (channel.engagementRate ?? 0), 0) /
        Math.max(
          1,
          context.organic.channels.filter((channel) => channel.engagementRate != null).length,
        );

    if ((leader.engagementRate ?? 0) <= averageEngagementRate * 1.2) {
      return null;
    }

    return {
      id: `organic-opportunity-${leader.provider}`,
      type: "organic",
      severity: "medium",
      title: `${leader.channel} is outperforming organic baseline`,
      explanation: `${leader.channel} delivered a ${(leader.engagementRate ?? 0).toFixed(2)}% engagement rate during ${context.rangeLabel.toLowerCase()}, above the organic average of ${averageEngagementRate.toFixed(2)}%.`,
      evidence: [
        { label: "Channel engagement rate", value: `${(leader.engagementRate ?? 0).toFixed(2)}%` },
        { label: "Organic average", value: `${averageEngagementRate.toFixed(2)}%` },
        { label: "Published posts", value: String(leader.published) },
      ],
      estimatedImpact: "Create more content in this high-performing format",
      action: { label: "Create Content", href: "/content/studio/new" },
      category: "organic",
      generatedAt: new Date().toISOString(),
      confidence: 0.78,
    };
  },
};

const publishingConsistencyRule: MarketingSignalRule = {
  id: "publishing-consistency",
  evaluate(context) {
    if (context.organic.connectedCount === 0) {
      return null;
    }

    if (
      context.publishing.daysWithoutScheduled == null ||
      context.publishing.daysWithoutScheduled < 5
    ) {
      return null;
    }

    return {
      id: "publishing-consistency",
      type: "organic",
      severity: "medium",
      title: "Publishing gap detected",
      explanation: `No organic content is scheduled for the next ${context.publishing.daysWithoutScheduled} days despite active social connections.`,
      evidence: [
        { label: "Scheduled upcoming", value: String(context.publishing.scheduledUpcoming) },
        { label: "Published in period", value: String(context.publishing.publishedInRange) },
        {
          label: "Strongest format",
          value: context.publishing.strongestOrganicFormat ?? "Not identified",
        },
      ],
      estimatedImpact: "Consistent publishing supports organic reach momentum",
      action: { label: "Open Calendar", href: "/calendar" },
      category: "organic",
      generatedAt: new Date().toISOString(),
      confidence: 0.74,
    };
  },
};

const crossChannelRule: MarketingSignalRule = {
  id: "cross-channel-repurpose",
  evaluate(context) {
    if (context.paid.connectedCount === 0 || context.organic.connectedCount === 0) {
      return null;
    }

    const paidLeader = [...context.paid.byProvider].sort((a, b) => b.conversions - a.conversions)[0];
    const organicLeader = [...context.organic.channels]
      .filter((channel) => channel.connected)
      .sort((a, b) => (b.engagement ?? 0) - (a.engagement ?? 0))[0];

    if (!paidLeader || !organicLeader || paidLeader.conversions < 5 || (organicLeader.engagement ?? 0) <= 0) {
      return null;
    }

    return {
      id: "cross-channel-repurpose",
      type: "cross-channel",
      severity: "info",
      title: "Repurpose high-performing paid themes organically",
      explanation: `Paid conversions are strongest on ${paidLeader.provider}, while ${organicLeader.channel} is generating the highest organic engagement. Consider adapting the paid creative theme into organic short-form content.`,
      evidence: [
        { label: "Top paid channel", value: paidLeader.provider },
        { label: "Paid conversions", value: String(paidLeader.conversions) },
        { label: "Top organic channel", value: organicLeader.channel },
        { label: "Organic engagement", value: String(organicLeader.engagement ?? 0) },
      ],
      estimatedImpact: "Lower CAC by extending proven creative themes organically",
      action: { label: "Create Content", href: "/content/studio/new" },
      category: "cross-channel",
      generatedAt: new Date().toISOString(),
      confidence: 0.7,
    };
  },
};

const formatOpportunityRule: MarketingSignalRule = {
  id: "format-opportunity",
  evaluate(context) {
    const formats = context.formatPerformance ?? [];
    if (formats.length < 2) return null;

    const withRates = formats.filter(
      (item) => item.averageEngagementRate != null && item.contentCount >= 3,
    );
    if (withRates.length < 2) return null;

    const average =
      withRates.reduce((sum, item) => sum + (item.averageEngagementRate ?? 0), 0) / withRates.length;
    const leader = [...withRates].sort(
      (a, b) => (b.averageEngagementRate ?? 0) - (a.averageEngagementRate ?? 0),
    )[0];
    if (!leader?.averageEngagementRate || leader.averageEngagementRate <= average * 1.15) {
      return null;
    }

    const uplift = ((leader.averageEngagementRate - average) / average) * 100;

    return {
      id: `format-opportunity-${leader.format}`,
      type: "organic",
      severity: uplift >= 30 ? "high" : "medium",
      title: `${leader.format} outperforms other organic formats`,
      explanation: `${leader.format} generated ${uplift.toFixed(0)}% higher engagement than the organic format average during ${context.rangeLabel.toLowerCase()}.`,
      evidence: [
        { label: "Format engagement rate", value: `${leader.averageEngagementRate.toFixed(2)}%` },
        { label: "Format average", value: `${average.toFixed(2)}%` },
        { label: "Content count", value: String(leader.contentCount) },
      ],
      estimatedImpact: `Consider increasing ${leader.format} output`,
      action: { label: "Create Content", href: "/content/studio/new" },
      category: "organic",
      generatedAt: new Date().toISOString(),
      confidence: 0.8,
    };
  },
};

const engagementAnomalyRule: MarketingSignalRule = {
  id: "engagement-anomaly",
  evaluate(context) {
    if (
      context.organic.engagement == null ||
      context.organic.previousEngagement == null ||
      context.organic.previousEngagement <= 0
    ) {
      return null;
    }

    const change =
      ((context.organic.engagement - context.organic.previousEngagement) /
        context.organic.previousEngagement) *
      100;
    if (change > -20) return null;

    return {
      id: "engagement-anomaly",
      type: "anomaly",
      severity: change <= -35 ? "high" : "medium",
      title: "Organic engagement declined materially",
      explanation: `Total organic engagement fell ${Math.abs(change).toFixed(1)}% compared with ${context.comparisonLabel.toLowerCase()}.`,
      evidence: [
        { label: "Current engagement", value: String(context.organic.engagement) },
        { label: "Previous engagement", value: String(context.organic.previousEngagement) },
        {
          label: "Engagement rate",
          value:
            context.organic.engagementRate != null
              ? `${context.organic.engagementRate.toFixed(2)}%`
              : "—",
        },
      ],
      estimatedImpact: "Review recent content performance and publishing cadence",
      action: { label: "View Performance", href: "/social/performance" },
      category: "organic",
      generatedAt: new Date().toISOString(),
      confidence: 0.86,
    };
  },
};

const organicToPaidRule: MarketingSignalRule = {
  id: "organic-to-paid",
  evaluate(context) {
    const topOrganic = context.topOrganicContent?.[0];
    if (!topOrganic || topOrganic.engagement < 20) return null;
    if (context.paid.connectedCount === 0) return null;

    const baseline =
      context.organic.engagementRate ??
      context.organic.channels
        .filter((channel) => channel.engagementRate != null)
        .reduce((sum, channel) => sum + (channel.engagementRate ?? 0), 0) /
        Math.max(1, context.organic.channels.filter((channel) => channel.engagementRate != null).length);

    if (topOrganic.engagementRate == null || baseline <= 0) return null;
    if (topOrganic.engagementRate < baseline * 1.5) return null;

    return {
      id: `organic-to-paid-${topOrganic.id}`,
      type: "cross-channel",
      severity: "medium",
      title: "High-performing organic content may translate to paid",
      explanation: `"${topOrganic.title}" on ${topOrganic.channel} generated ${topOrganic.engagementRate.toFixed(2)}% engagement — above your organic baseline of ${baseline.toFixed(2)}%. Consider testing this concept as a paid creative.`,
      evidence: [
        { label: "Content", value: topOrganic.title },
        { label: "Engagement rate", value: `${topOrganic.engagementRate.toFixed(2)}%` },
        { label: "Organic baseline", value: `${baseline.toFixed(2)}%` },
        { label: "Total engagement", value: String(topOrganic.engagement) },
      ],
      estimatedImpact: "Test proven organic concepts in paid channels",
      action: { label: "Review for Paid", href: "/advertising/creatives" },
      category: "cross-channel",
      generatedAt: new Date().toISOString(),
      confidence: 0.76,
    };
  },
};

const paidToOrganicRule: MarketingSignalRule = {
  id: "paid-to-organic",
  evaluate(context) {
    const topPaid = context.topPaidCreatives?.[0];
    if (!topPaid || topPaid.conversions < 5) return null;
    if (context.organic.connectedCount === 0) return null;

    const roas = topPaid.roas;
    const portfolioRoas = context.paid.roas;
    if (roas == null || portfolioRoas == null || roas < portfolioRoas * 1.2) return null;

    return {
      id: `paid-to-organic-${topPaid.id}`,
      type: "cross-channel",
      severity: "medium",
      title: "Repurpose high-performing paid creative organically",
      explanation: `"${topPaid.name}" is generating ${roas.toFixed(1)}x ROAS on ${topPaid.provider} versus a ${portfolioRoas.toFixed(1)}x portfolio average. The concept has not been surfaced in your organic short-form pipeline.`,
      evidence: [
        { label: "Creative", value: topPaid.name },
        { label: "ROAS", value: `${roas.toFixed(1)}x` },
        { label: "Portfolio ROAS", value: `${portfolioRoas.toFixed(1)}x` },
        { label: "Conversions", value: String(topPaid.conversions) },
      ],
      estimatedImpact: "Extend paid winners into organic Reels and Shorts",
      action: {
        label: "Repurpose",
        href: `/content/studio/new?repurposeFrom=${encodeURIComponent(topPaid.id)}`,
      },
      category: "cross-channel",
      generatedAt: new Date().toISOString(),
      confidence: 0.79,
    };
  },
};

const publishingGapRule: MarketingSignalRule = {
  id: "publishing-gap",
  evaluate(context) {
    const gap = context.scheduleGaps?.[0];
    if (!gap) return null;

    return {
      id: `publishing-gap-${gap.channel}`,
      type: "organic",
      severity: "medium",
      title: "Publishing schedule gap",
      explanation: gap.message,
      evidence: [
        { label: "Channel", value: gap.channel },
        { label: "Scheduled upcoming", value: String(context.publishing.scheduledUpcoming) },
      ],
      estimatedImpact: "Fill schedule gaps to maintain organic momentum",
      action: { label: "Open Calendar", href: "/calendar" },
      category: "organic",
      generatedAt: new Date().toISOString(),
      confidence: 0.72,
    };
  },
};

const channelContributionShiftRule: MarketingSignalRule = {
  id: "channel-contribution-shift",
  evaluate(context) {
    const shift = context.analytics?.channelContributionShift;
    if (!shift || !context.analytics?.attributionModel) return null;

    return {
      id: `channel-contribution-shift-${shift.channel}`,
      type: "cross-channel",
      severity: "medium",
      title: `${shift.channel} contribution shifted under ${context.analytics.attributionModel}`,
      explanation: `${shift.channel} contribution moved from ${shift.fromPercent.toFixed(0)}% to ${shift.toPercent.toFixed(0)}% of attributed revenue during ${context.rangeLabel.toLowerCase()}.`,
      evidence: [
        { label: "Attribution model", value: context.analytics.attributionModel },
        { label: "Previous share", value: `${shift.fromPercent.toFixed(0)}%` },
        { label: "Current share", value: `${shift.toPercent.toFixed(0)}%` },
      ],
      category: "cross-channel",
      generatedAt: new Date().toISOString(),
      confidence: 0.78,
    };
  },
};

const organicAssistRule: MarketingSignalRule = {
  id: "organic-assist",
  evaluate(context) {
    const rate = context.analytics?.organicAssistRate;
    if (rate == null || rate < 15) return null;

    return {
      id: "organic-assist",
      type: "cross-channel",
      severity: rate >= 30 ? "high" : "medium",
      title: "Organic interactions precede paid-attributed conversions",
      explanation: `${rate.toFixed(0)}% of paid-attributed conversions included a prior organic interaction during ${context.rangeLabel.toLowerCase()}. This indicates correlation, not proven causation.`,
      evidence: [
        { label: "Organic assist rate", value: `${rate.toFixed(0)}%` },
        { label: "Attribution model", value: context.analytics?.attributionModel ?? "Last Touch" },
      ],
      estimatedImpact: "Review organic content supporting paid conversion paths",
      action: { label: "View Attribution", href: "/analytics/attribution" },
      category: "cross-channel",
      generatedAt: new Date().toISOString(),
      confidence: 0.74,
    };
  },
};

const contentRevenueOpportunityRule: MarketingSignalRule = {
  id: "content-revenue-opportunity",
  evaluate(context) {
    const assisted = context.analytics?.contentAssistedRevenue;
    const attributed = context.analytics?.contentAttributedRevenue;
    if (assisted == null || assisted <= 0 || attributed == null) return null;
    if (assisted < attributed * 2) return null;

    return {
      id: "content-revenue-opportunity",
      type: "opportunity",
      severity: "medium",
      title: "Content appears in high-value conversion journeys",
      explanation: `Content items appeared in journeys representing ${formatCurrency(assisted)} of assisted revenue. Under ${context.analytics?.attributionModel ?? "the selected model"}, direct attributed revenue is ${formatCurrency(attributed)}.`,
      evidence: [
        { label: "Assisted revenue", value: formatCurrency(assisted) },
        { label: "Attributed revenue", value: formatCurrency(attributed) },
        { label: "Attribution model", value: context.analytics?.attributionModel ?? "—" },
      ],
      estimatedImpact: "Assisted revenue is distinct from attributed credit",
      action: { label: "View Content Analytics", href: "/analytics/content" },
      category: "cross-channel",
      generatedAt: new Date().toISOString(),
      confidence: 0.76,
    };
  },
};

const attributionCoverageIssueRule: MarketingSignalRule = {
  id: "attribution-coverage-issue",
  evaluate(context) {
    const coverage = context.analytics?.attributionCoveragePercent;
    const revenueCoverage = context.analytics?.revenueCoveragePercent;
    const metric = coverage ?? revenueCoverage;
    if (metric == null || metric >= 70) return null;

    return {
      id: "attribution-coverage-issue",
      type: "anomaly",
      severity: metric < 50 ? "high" : "medium",
      title: "Attribution coverage is limited",
      explanation: `Only ${metric.toFixed(0)}% of observed outcomes can currently be connected to tracked marketing touchpoints. Revenue attribution confidence is limited.`,
      evidence: [
        { label: "Coverage", value: `${metric.toFixed(0)}%` },
        {
          label: "Observed revenue",
          value:
            context.analytics?.observedRevenue != null
              ? formatCurrency(context.analytics.observedRevenue)
              : "Unavailable",
        },
      ],
      estimatedImpact: "Improve tracking coverage before reallocating budget",
      action: { label: "Review tracking", href: "/analytics/executive/data-health" },
      category: "cross-channel",
      generatedAt: new Date().toISOString(),
      confidence: 0.8,
    };
  },
};

const trackingDiscrepancyRule: MarketingSignalRule = {
  id: "tracking-discrepancy",
  evaluate(context) {
    const discrepancy = context.analytics?.providerDiscrepancies?.[0];
    if (!discrepancy || discrepancy.providerConversions <= 0) return null;

    const delta =
      ((discrepancy.providerConversions - discrepancy.trackedConversions) /
        discrepancy.providerConversions) *
      100;

    return {
      id: `tracking-discrepancy-${discrepancy.provider}`,
      type: "anomaly",
      severity: Math.abs(delta) >= 25 ? "high" : "medium",
      title: `${discrepancy.provider} conversion reporting mismatch`,
      explanation: `${discrepancy.provider} reports ${discrepancy.providerConversions} conversions versus ${discrepancy.trackedConversions} Cresco-tracked conversions (${delta > 0 ? "+" : ""}${delta.toFixed(0)}%). Possible causes include attribution window differences, cross-device reporting, consent loss, or tracking gaps.`,
      evidence: [
        { label: "Provider-reported", value: String(discrepancy.providerConversions) },
        { label: "Cresco tracked", value: String(discrepancy.trackedConversions) },
      ],
      category: "paid",
      generatedAt: new Date().toISOString(),
      confidence: 0.77,
    };
  },
};

const funnelDropRule: MarketingSignalRule = {
  id: "funnel-drop",
  evaluate(context) {
    const dropOff = context.analytics?.funnelClickVisitDropOff;
    if (dropOff == null || dropOff < 50) return null;

    return {
      id: "funnel-click-visit-drop",
      type: "anomaly",
      severity: dropOff >= 70 ? "high" : "medium",
      title: "Click-to-visit continuity gap detected",
      explanation: `Click-to-visit continuity shows a ${dropOff.toFixed(0)}% drop during ${context.rangeLabel.toLowerCase()}. Possible causes include tracking loss, slow landing pages, redirects, or channel reporting mismatch.`,
      evidence: [{ label: "Click → visit drop-off", value: `${dropOff.toFixed(0)}%` }],
      action: { label: "View Funnels", href: "/analytics/funnels" },
      category: "cross-channel",
      generatedAt: new Date().toISOString(),
      confidence: 0.71,
    };
  },
};

export const marketingSignalRules: MarketingSignalRule[] = [
  budgetOpportunityRule,
  cpaAnomalyRule,
  organicOpportunityRule,
  publishingConsistencyRule,
  crossChannelRule,
  formatOpportunityRule,
  engagementAnomalyRule,
  organicToPaidRule,
  paidToOrganicRule,
  publishingGapRule,
  channelContributionShiftRule,
  organicAssistRule,
  contentRevenueOpportunityRule,
  attributionCoverageIssueRule,
  trackingDiscrepancyRule,
  funnelDropRule,
];

export function evaluateMarketingSignals(context: MarketingIntelligenceContext): MarketingSignal[] {
  return rankMarketingSignals(context).slice(0, 5);
}

export function evaluateAllMarketingSignals(
  context: MarketingIntelligenceContext,
): MarketingSignal[] {
  return rankMarketingSignals(context);
}

function rankMarketingSignals(context: MarketingIntelligenceContext): MarketingSignal[] {
  const signals = marketingSignalRules
    .map((rule) => rule.evaluate(context))
    .filter((signal): signal is MarketingSignal => signal != null);

  return signals
    .sort((a, b) => {
      const severityRank = { high: 3, medium: 2, info: 1 };
      const severityDiff = severityRank[b.severity] - severityRank[a.severity];
      if (severityDiff !== 0) {
        return severityDiff;
      }
      return b.confidence - a.confidence;
    });
}
