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

export const marketingSignalRules: MarketingSignalRule[] = [
  budgetOpportunityRule,
  cpaAnomalyRule,
  organicOpportunityRule,
  publishingConsistencyRule,
  crossChannelRule,
];

export function evaluateMarketingSignals(context: MarketingIntelligenceContext): MarketingSignal[] {
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
    })
    .slice(0, 5);
}
