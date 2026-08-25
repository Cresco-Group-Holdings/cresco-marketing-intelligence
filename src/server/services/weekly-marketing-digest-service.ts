import { prisma } from "@/lib/database/prisma";
import { evaluateMarketingSignals } from "@/lib/marketing-intelligence/engine";
import type { MarketingIntelligenceContext } from "@/lib/marketing-intelligence/types";
import { logger } from "@/lib/logging";
import { notificationService } from "@/server/services/notification-service";
import { NOTIFICATION_EVENT_TYPES } from "@/lib/notifications/constants";

export type WeeklyDigestSection = {
  title: string;
  body: string;
  available: boolean;
};

export type WeeklyMarketingDigest = {
  organisationId: string;
  brandId: string;
  generatedAt: string;
  sections: WeeklyDigestSection[];
  summary: string;
};

function emptyIntelligenceContext(rangeLabel: string): MarketingIntelligenceContext {
  return {
    rangeLabel,
    comparisonLabel: "previous period",
    paid: {
      connectedCount: 0,
      totalProviders: 0,
      spend: 0,
      previousSpend: 0,
      conversions: 0,
      previousConversions: 0,
      revenue: 0,
      previousRevenue: 0,
      roas: null,
      previousRoas: null,
      cpa: null,
      previousCpa: null,
      byProvider: [],
      freshness: "unavailable",
      lastSyncedAt: null,
    },
    organic: {
      connectedCount: 0,
      totalProviders: 0,
      reach: null,
      previousReach: null,
      engagement: null,
      previousEngagement: null,
      engagementRate: null,
      published: 0,
      scheduled: 0,
      channels: [],
      freshness: "unavailable",
      lastSyncedAt: null,
    },
    publishing: {
      publishedInRange: 0,
      scheduledUpcoming: 0,
      daysWithoutScheduled: null,
      strongestOrganicFormat: null,
    },
    connectivity: {
      paidConnected: 0,
      paidTotal: 0,
      organicConnected: 0,
      organicTotal: 0,
    },
  };
}

export const weeklyMarketingDigestService = {
  async generate(organisationId: string, brandId: string): Promise<WeeklyMarketingDigest> {
    const brand = await prisma.brand.findFirst({
      where: { id: brandId, organisationId },
      select: { id: true, projectId: true, name: true },
    });
    if (!brand) {
      throw new Error("Brand not found.");
    }

    const signals = evaluateMarketingSignals(emptyIntelligenceContext("the past 7 days"));

    const paid = signals.filter((s) => s.category === "paid");
    const organic = signals.filter((s) => s.category === "organic");
    const risks = signals.filter((s) => s.severity === "high");
    const opportunities = signals.filter((s) => s.type === "opportunity");

    const sections: WeeklyDigestSection[] = [
      {
        title: "Executive Summary",
        body:
          signals.length > 0
            ? `${signals.length} marketing signals evaluated for ${brand.name}.`
            : "Insufficient connected data to generate an executive summary this week.",
        available: signals.length > 0,
      },
      {
        title: "What Changed",
        body:
          signals.slice(0, 3).map((s) => s.explanation).join(" ") ||
          "No significant week-over-week changes detected.",
        available: signals.length > 0,
      },
      {
        title: "Paid Performance",
        body: paid.length > 0 ? paid.map((s) => s.explanation).join(" ") : "Paid performance data unavailable.",
        available: paid.length > 0,
      },
      {
        title: "Organic Growth",
        body:
          organic.length > 0 ? organic.map((s) => s.explanation).join(" ") : "Organic analytics unavailable.",
        available: organic.length > 0,
      },
      {
        title: "Risks",
        body: risks.length > 0 ? risks.map((s) => s.explanation).join(" ") : "No material risks detected.",
        available: risks.length > 0,
      },
      {
        title: "Opportunities",
        body:
          opportunities.length > 0
            ? opportunities.map((s) => s.explanation).join(" ")
            : "No new opportunities identified.",
        available: opportunities.length > 0,
      },
      {
        title: "Recommended Priorities",
        body:
          signals
            .slice(0, 3)
            .map((s) => s.title)
            .join(" · ") || "Review Command Centre priorities.",
        available: signals.length > 0,
      },
    ];

    const digest: WeeklyMarketingDigest = {
      organisationId,
      brandId,
      generatedAt: new Date().toISOString(),
      sections,
      summary: sections.find((s) => s.title === "Executive Summary")?.body ?? "",
    };

    const recipients = await prisma.organisationMembership.findMany({
      where: { organisationId, role: { in: ["OWNER", "ADMIN"] } },
      select: { userId: true },
      take: 10,
    });

    if (recipients.length > 0) {
      await notificationService.emit({
        organisationId,
        projectId: brand.projectId,
        brandId,
        recipientUserIds: recipients.map((r) => r.userId),
        eventType: NOTIFICATION_EVENT_TYPES.AUTOMATION_RESULT,
        title: "Weekly marketing digest",
        body: digest.summary,
        idempotencyKey: `weekly-digest:${brandId}:${digest.generatedAt.slice(0, 10)}`,
        actionPath: "/command-centre",
      });
    }

    logger.info("digest.weekly_generated", { organisationId, brandId });
    return digest;
  },
};
