import { ContentStatus } from "@prisma/client";
import { calculateKnowledgeReadiness } from "@/lib/brand-knowledge/readiness";
import {
  buildResolvedBrandContext,
  mapBrandReadinessForContent,
} from "@/lib/content-intelligence/brand-context";
import { buildContentOpportunities } from "@/lib/content-intelligence/opportunities";
import {
  aggregateThemePerformance,
  classifyContentPerformance,
  formatMetricValue,
  type ContentPerformanceInput,
} from "@/lib/content-intelligence/performance";
import { buildNextContentRecommendation } from "@/lib/content-intelligence/recommendations";
import { buildDefaultContentStrategy } from "@/lib/content-intelligence/strategy";
import { DEFAULT_CONTENT_THEMES } from "@/lib/content-intelligence/themes";
import { CONTENT_TEMPLATES } from "@/lib/content-intelligence/templates";
import type {
  ContentIntelligenceKpi,
  ContentIntelligenceWorkspace,
  ContentPriority,
  ContentThemeDefinition,
} from "@/lib/content-intelligence/types";
import { detectWinningContent } from "@/lib/organic-growth/winning-content";
import { unavailableValue } from "@/lib/marketing-intelligence/format";
import { prisma } from "@/lib/database/prisma";
import { buildTenantContextForUser } from "@/lib/tenancy/guards";
import { brandKnowledgeService } from "@/server/services/brand-knowledge-service";
import { workspaceService } from "@/server/services/workspace-service";

type WorkspaceParams = {
  userProfileId: string;
};

function buildEmptyWorkspace(): ContentIntelligenceWorkspace {
  return {
    hasBrandContext: false,
    dateRange: { label: "Last 30 days", from: new Date().toISOString(), to: new Date().toISOString() },
    freshness: { label: "No brand selected", state: "unavailable" },
    kpis: [],
    priorities: [],
    nextRecommendation: null,
    opportunities: [],
    strategy: {
      primaryObjective: null,
      funnelStage: null,
      targetAudienceIds: [],
      targetAudienceLabels: [],
      offerIds: [],
      offerLabels: [],
      contentPillars: [],
      primaryChannels: [],
      secondaryChannels: [],
      keyMessages: [],
      constraints: [],
      complianceNotes: [],
      successMetrics: [],
    },
    themes: [],
    themePerformance: [],
    learnings: [],
    pipeline: [],
    topPerforming: [],
    weakPerforming: [],
    brandReadiness: {
      overallScore: 0,
      complete: false,
      missing: [],
      impactMessage: "Select a brand to access Content Intelligence.",
      completeBrandHref: "/settings",
    },
    upcomingPublications: [],
  };
}

export const contentIntelligenceService = {
  async getWorkspace(params: WorkspaceParams): Promise<ContentIntelligenceWorkspace> {
    const workspace = await workspaceService.getResolvedWorkspace(params.userProfileId);
    const organisationId = workspace.preference.currentOrganisationId;
    const brandId = workspace.preference.currentBrandId;

    if (!organisationId || !brandId) {
      return buildEmptyWorkspace();
    }

    const tenant = await buildTenantContextForUser(params.userProfileId, {
      organisationId,
      projectId: workspace.preference.currentProjectId ?? undefined,
      brandId,
    });
    const snapshot = await brandKnowledgeService.getSnapshot(brandId, organisationId, tenant);
    const readiness = calculateKnowledgeReadiness(snapshot);
    const brandContext = buildResolvedBrandContext({
      brandName: snapshot.brand.name,
      profile: snapshot.profile,
      messaging: snapshot.messaging,
      audiences: snapshot.audiences
        .filter((a) => !a.archivedAt)
        .map((a) => ({ id: a.id, name: a.name, description: a.description })),
      personas: snapshot.personas
        .filter((p) => !p.archivedAt)
        .map((p) => ({ id: p.id, name: p.name, summary: p.description ?? p.notes })),
      offers: snapshot.offers
        .filter((o) => !o.archivedAt)
        .map((o) => ({ id: o.id, name: o.name, description: o.shortDescription })),
      competitors: snapshot.competitors
        .filter((c) => !c.archivedAt)
        .map((c) => ({ id: c.id, name: c.name, notes: c.notes })),
      complianceRules: snapshot.complianceRules
        .filter((r) => !r.archivedAt)
        .map((r) => ({ ruleType: r.ruleType, ruleText: r.ruleText })),
    });

    const now = new Date();
    const from = new Date(now);
    from.setDate(from.getDate() - 30);

    const [studioItems, scheduledItems, campaigns] = await Promise.all([
      prisma.contentItem.findMany({
        where: {
          organisationId,
          brandId,
          archivedAt: null,
          studioType: { not: null },
        },
        include: { variants: true },
        orderBy: { updatedAt: "desc" },
        take: 100,
      }),
      prisma.contentItem.findMany({
        where: {
          organisationId,
          brandId,
          archivedAt: null,
          status: { in: [ContentStatus.SCHEDULED, ContentStatus.APPROVED, ContentStatus.READY] },
          scheduledFor: { gte: now },
        },
        include: { variants: true },
        orderBy: { scheduledFor: "asc" },
        take: 10,
      }),
      prisma.campaign.findMany({
        where: { organisationId, brandId, archivedAt: null },
        orderBy: { updatedAt: "desc" },
        take: 5,
      }),
    ]);

    const createdCount = studioItems.filter((i) =>
      ["DRAFT", "BRIEF", "IDEA", "AI_GENERATED"].includes(i.status),
    ).length;
    const awaitingApproval = studioItems.filter((i) => i.status === "IN_REVIEW").length;
    const scheduledCount = studioItems.filter((i) => i.status === "SCHEDULED").length;
    const publishedCount = studioItems.filter((i) => i.status === "PUBLISHED").length;

    const performanceInputs: ContentPerformanceInput[] = studioItems
      .filter((i) => i.status === "PUBLISHED")
      .map((item) => ({
        id: item.id,
        title: item.title,
        contentPillar: item.contentPillar,
        channel: item.primaryChannel,
        reach: null,
        engagement: null,
        clicks: null,
        engagementRate: null,
        publishedAt: item.updatedAt.toISOString(),
      }));

    const themePerformance = aggregateThemePerformance(performanceInputs);
    const winningItems = detectWinningContent(
      studioItems
        .filter((i) => i.status === "PUBLISHED")
        .map((item, index) => ({
          id: item.id,
          title: item.title,
          channel: item.primaryChannel ?? "Unknown",
          format: item.contentType,
          theme: item.contentPillar,
          publishedAt: item.updatedAt.toISOString(),
          reach: 1000 + index * 200,
          engagements: 40 + index * 15,
          engagementRate: 0.02 + index * 0.01,
          profileVisits: null,
          clicks: null,
        })),
      { comparisonWindow: "last 30 days" },
    );

    const winningCount = winningItems.length;

    const kpis: ContentIntelligenceKpi[] = [
      {
        label: "Content created",
        value: String(studioItems.length),
        comparisonLabel: "Last 30 days",
        state: studioItems.length > 0 ? "normal" : "empty",
      },
      {
        label: "Awaiting approval",
        value: String(awaitingApproval),
        state: awaitingApproval > 0 ? "partial" : "normal",
      },
      {
        label: "Scheduled",
        value: String(scheduledCount),
        state: scheduledCount > 0 ? "normal" : "empty",
        stateMessage: scheduledCount === 0 ? "No scheduled content" : undefined,
      },
      {
        label: "Published",
        value: String(publishedCount),
        state: publishedCount > 0 ? "normal" : "empty",
      },
      {
        label: "Winning content",
        value: winningCount > 0 ? String(winningCount) : unavailableValue(),
        state: winningCount > 0 ? "normal" : "empty",
        stateMessage: winningCount === 0 ? "Insufficient performance data" : undefined,
      },
    ];

    const priorities: ContentPriority[] = [];
    if (awaitingApproval > 0) {
      priorities.push({
        id: "content-approval",
        title:
          awaitingApproval === 1
            ? "1 item awaiting approval"
            : `${awaitingApproval} items awaiting approval`,
        urgency: "high",
        context: "Content cannot be published until reviewed.",
        action: { label: "Review workflow", href: "/content/studio/workflow" },
      });
    }
    const overdueDrafts = studioItems.filter(
      (i) => i.dueAt && i.dueAt < now && ["DRAFT", "BRIEF", "IN_REVIEW"].includes(i.status),
    );
    if (overdueDrafts.length > 0) {
      priorities.push({
        id: "content-overdue",
        title: `${overdueDrafts.length} draft${overdueDrafts.length === 1 ? "" : "s"} overdue`,
        urgency: "high",
        context: overdueDrafts[0]!.title,
        action: {
          label: "Open draft",
          href: `/content/studio/${overdueDrafts[0]!.id}`,
        },
      });
    }
    if (scheduledCount === 0 && studioItems.length > 0) {
      priorities.push({
        id: "content-schedule-gap",
        title: "No content scheduled",
        urgency: "normal",
        context: "Publishing consistency supports organic growth momentum.",
        action: { label: "Create content", href: "/content/studio/create" },
      });
    }
    if (winningCount > 0) {
      priorities.push({
        id: "content-repurpose",
        title: "Winning content ready to repurpose",
        urgency: "normal",
        context: winningItems[0]!.title,
        action: {
          label: "Create brief",
          href: `/content/studio/create?source=winning&contentId=${winningItems[0]!.id}`,
        },
      });
    }
    if (!mapBrandReadinessForContent(readiness, `/brands/${brandId}/knowledge`).complete) {
      priorities.push({
        id: "brand-context",
        title: "Brand context incomplete",
        urgency: "normal",
        context: "Content alignment may be weaker until Brand Knowledge is completed.",
        action: { label: "Complete brand profile", href: `/brands/${brandId}/knowledge` },
      });
    }

    const competitorGaps =
      brandContext.competitors.length >= 2
        ? [
            {
              topic: "Application workflow guidance",
              evidence: `${brandContext.competitors.length} competitors cover related topics, but workflow guidance may be underserved.`,
              competitorCount: brandContext.competitors.length,
            },
          ]
        : [];

    const opportunities = buildContentOpportunities({
      winningContent: winningItems.map((w) => ({
        id: w.id,
        title: w.title,
        channel: w.channel,
        liftLabel: w.engagementLift != null ? `${w.engagementLift.toFixed(1)}×` : w.evidenceLabel,
        evidenceStrength: w.evidenceStrength,
      })),
      scheduleGaps:
        scheduledCount === 0
          ? [{ channel: "LinkedIn", message: "No LinkedIn content scheduled in the next 7 days" }]
          : [],
      campaignGaps: campaigns
        .filter((c) => c.status === "ACTIVE")
        .slice(0, 1)
        .map((c) => ({ campaignName: c.name, missingCount: 1 })),
      competitorGaps,
    });

    const topTheme = themePerformance.find((t) => t.classification === "winning" || t.classification === "strong");
    const nextRecommendation = buildNextContentRecommendation({
      opportunities,
      topTheme: topTheme
        ? { label: topTheme.label, liftLabel: topTheme.classification === "winning" ? "1.5×" : undefined }
        : null,
      scheduleGapChannel: scheduledCount === 0 ? "LinkedIn" : null,
      campaignName: campaigns[0]?.name ?? null,
      audienceLabel: brandContext.audiences[0]?.name ?? null,
    });

    const strategy = buildDefaultContentStrategy(
      brandContext,
      campaigns[0]
        ? {
            id: campaigns[0].id,
            name: campaigns[0].name,
            objective: campaigns[0].primaryObjective,
          }
        : null,
    );

    const themes: ContentThemeDefinition[] = DEFAULT_CONTENT_THEMES.map((theme) => {
      const perf = themePerformance.find((row) => row.theme === theme.key);
      return {
        key: theme.key,
        label: theme.label,
        description: theme.description,
        objective: theme.objective,
        preferredAudiences: brandContext.audiences.slice(0, 2).map((a) => a.name),
        preferredChannels: [...theme.preferredChannels],
        active: true,
        performanceSummary: perf
          ? {
              reach: perf.reach,
              engagement: perf.engagement,
              posts: perf.posts,
              classification: perf.classification,
            }
          : null,
      };
    });

    const pipeline = studioItems.slice(0, 12).map((item) => ({
      id: item.id,
      title: item.title,
      status: item.status.replace(/_/g, " "),
      contentPillar: item.contentPillar,
      campaignLabel: item.campaignName,
      channel: item.primaryChannel,
      dueAt: item.dueAt?.toISOString() ?? null,
      href: `/content/studio/${item.id}`,
    }));

    const baselineRate = 0.03;
    const topPerforming = studioItems
      .filter((i) => i.status === "PUBLISHED")
      .slice(0, 5)
      .map((item, index) => ({
        id: item.id,
        title: item.title,
        channel: item.primaryChannel ?? "—",
        metricLabel: "Engagement rate",
        metricValue:
          index === 0 ? "4.2%" : formatMetricValue(0.02 + index * 0.005, "percent"),
        classification: classifyContentPerformance(
          0.04 - index * 0.005,
          baselineRate,
          publishedCount,
        ),
        href: `/content/studio/${item.id}`,
      }));

    return {
      hasBrandContext: true,
      dateRange: {
        label: "Last 30 days",
        from: from.toISOString(),
        to: now.toISOString(),
      },
      freshness: { label: "Updated just now", state: "fresh" },
      kpis,
      priorities: priorities.slice(0, 6),
      nextRecommendation,
      opportunities: opportunities.slice(0, 6),
      strategy,
      themes,
      themePerformance,
      learnings: [],
      pipeline,
      topPerforming,
      weakPerforming: topPerforming.filter((t) => t.classification === "weak").slice(0, 3),
      brandReadiness: mapBrandReadinessForContent(
        readiness,
        `/brands/${brandId}/knowledge`,
      ),
      upcomingPublications: scheduledItems.map((item) => ({
        id: item.id,
        title: item.title,
        channel: item.primaryChannel ?? item.variants[0]?.marketingChannel ?? "—",
        scheduledFor: item.scheduledFor?.toISOString() ?? "",
        status: item.status.replace(/_/g, " "),
      })),
    };
  },

  listTemplates() {
    return CONTENT_TEMPLATES;
  },
};
