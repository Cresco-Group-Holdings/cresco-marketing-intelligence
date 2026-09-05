import { createHash, randomBytes } from "node:crypto";
import PDFDocument from "pdfkit";
import type {
  Prisma,
  SocialReportExportFormat,
  SocialReportSectionType,
} from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";
import {
  collectDataLimitations,
  rankContentPerformance,
} from "@/lib/reports/calculations";
import {
  DEFAULT_REPORT_SECTIONS,
  DEFAULT_SELECTED_METRICS,
  DEFAULT_SHARE_EXPIRY_DAYS,
  SECTION_TYPE_LABELS,
  SHARE_TOKEN_BYTES,
} from "@/lib/reports/constants";
import {
  buildDeterministicReportNarrative,
  validateSocialReportNarrative,
} from "@/lib/reports/narrative-validation";
import type { SocialReportNarrative } from "@/lib/ai/social-report-output-schemas";
import { assertOrganisationScope, type TenantContext } from "@/lib/tenancy/context";
import type {
  SocialReportCreateInput,
  SocialReportScheduleInput,
} from "@/lib/validation/social-reports";
import { aiModelRegistry } from "@/lib/ai/model-registry";
import { aiRequestService } from "@/server/services/ai-request-service";
import { brandKnowledgeService } from "@/server/services/brand-knowledge-service";
import { brandContextBuilder } from "@/lib/ai/brand-context-builder";
import { growthIntelligenceService } from "@/server/services/growth-intelligence-service";
import { socialAnalyticsQueryService } from "@/server/services/social-analytics-query-service";
import { recordAuditEvent } from "@/server/services/audit-service";
import { brandService } from "@/server/services/workspace-service";

type BrandScope = {
  organisationId: string;
  projectId: string;
  brandId: string;
};

async function resolveBrandScope(
  brandId: string,
  organisationId: string,
  context: TenantContext,
): Promise<BrandScope> {
  const brand = await brandService.getById(brandId, organisationId, context);
  return { organisationId, projectId: brand.projectId, brandId };
}

function buildFilters(input: SocialReportCreateInput) {
  return {
    from: new Date(input.periodStart),
    to: new Date(input.periodEnd),
    timezone: input.timezone,
    socialAccountId: input.accountIds?.[0],
    provider: input.provider,
    campaign: input.campaign,
  };
}

async function assertRecipientsAreMembers(organisationId: string, userIds: string[]) {
  for (const userId of userIds) {
    const membership = await prisma.organisationMembership.findFirst({
      where: { organisationId, userId, status: "ACTIVE" },
      include: { user: { select: { email: true } } },
    });
    if (!membership) {
      throw new AppError(
        "VALIDATION_ERROR",
        "Report recipients must be active organisation members.",
      );
    }
  }
}

async function buildReportSnapshot(
  scope: BrandScope,
  input: SocialReportCreateInput,
  context: TenantContext,
) {
  const filters = buildFilters(input);
  const [overview, contentAttribution, platformAttribution, insights, leadsCreated, syncPending] =
    await Promise.all([
      socialAnalyticsQueryService.overview(scope.brandId, scope.organisationId, filters, context),
      socialAnalyticsQueryService.attribution(
        scope.brandId,
        scope.organisationId,
        filters,
        "CONTENT_ITEM",
        context,
      ),
      socialAnalyticsQueryService.attribution(
        scope.brandId,
        scope.organisationId,
        filters,
        "PLATFORM",
        context,
      ),
      growthIntelligenceService.listInsights(scope.brandId, scope.organisationId, context, {
        limit: 10,
      }),
      prisma.marketingLead.count({
        where: {
          organisationId: scope.organisationId,
          brandId: scope.brandId,
          status: { not: "DELETED" },
          createdAt: { gte: filters.from, lte: filters.to },
        },
      }),
      prisma.socialAnalyticsSync.count({
        where: {
          organisationId: scope.organisationId,
          brandId: scope.brandId,
          status: { in: ["QUEUED", "RUNNING"] },
        },
      }),
    ]);

  const ranked = rankContentPerformance(contentAttribution.groups, "engagements");
  const dataLimitations = collectDataLimitations({
    postsMeasured: overview.postsMeasured,
    accountsMeasured: overview.accountsMeasured,
    syncIncomplete: syncPending > 0,
  });

  return {
    overview,
    contentAttribution,
    platformAttribution,
    insights,
    leadsCreated,
    topContent: ranked.top,
    weakContent: ranked.weak,
    dataLimitations,
  };
}

function sectionContent(
  sectionType: SocialReportSectionType,
  snapshot: Awaited<ReturnType<typeof buildReportSnapshot>>,
  input: SocialReportCreateInput,
) {
  switch (sectionType) {
    case "OVERVIEW":
      return {
        totals: snapshot.overview.totals,
        derived: snapshot.overview.derived,
        postsMeasured: snapshot.overview.postsMeasured,
        accountsMeasured: snapshot.overview.accountsMeasured,
      };
    case "PUBLISHING":
      return {
        postsPublished: snapshot.overview.derived.publishingConsistency,
        postsMeasured: snapshot.overview.postsMeasured,
      };
    case "REACH_IMPRESSIONS":
      return {
        impressions: snapshot.overview.totals.impressions ?? null,
        reach: snapshot.overview.totals.reach ?? null,
        byProvider: snapshot.overview.byProvider,
      };
    case "ENGAGEMENT":
      return {
        engagements: snapshot.overview.totals.engagements ?? null,
        engagementRate: snapshot.overview.derived.engagementRate,
        clickThroughRate: snapshot.overview.derived.clickThroughRate,
      };
    case "VIDEO_PERFORMANCE":
      return {
        views: snapshot.overview.totals.views ?? snapshot.overview.totals.videoViews ?? null,
        averageViewsPerPost: snapshot.overview.derived.averageViewsPerPost,
      };
    case "FOLLOWER_GROWTH":
      return {
        followerGrowth: snapshot.overview.derived.followerGrowth,
        byProvider: snapshot.platformAttribution.groups.map((group) => ({
          provider: group.label,
          followerGrowth: group.derived.followerGrowth,
        })),
      };
    case "TOP_CONTENT":
      return { items: snapshot.topContent };
    case "WEAK_CONTENT":
      return { items: snapshot.weakContent };
    case "LEADS":
      return { leadsCreated: snapshot.leadsCreated };
    case "CAMPAIGN_OUTCOMES":
      return {
        campaigns: snapshot.contentAttribution.groups
          .filter((group) => group.dimension === "CONTENT_ITEM")
          .slice(0, 10),
      };
    case "RECOMMENDATIONS":
      return {
        insights: input.includeRecommendations === false ? [] : snapshot.insights,
      };
    case "DATA_LIMITATIONS":
      return { limitations: snapshot.dataLimitations };
    case "CUSTOM_NOTES":
      return { notes: input.customNotes ?? null };
    default:
      return {};
  }
}

async function generateNarrative(
  scope: BrandScope,
  snapshot: Awaited<ReturnType<typeof buildReportSnapshot>>,
  context: TenantContext,
  requestId?: string,
): Promise<{ narrative: SocialReportNarrative; source: "AI" | "DETERMINISTIC"; aiRequestId?: string }> {
  const deterministic = buildDeterministicReportNarrative({
    overview: snapshot.overview,
    topContent: snapshot.topContent.map((item) => ({
      label: item.label,
      score: Number(item.score),
    })),
    weakContent: snapshot.weakContent.map((item) => ({
      label: item.label,
      score: Number(item.score),
    })),
    leadsCreated: snapshot.leadsCreated,
    dataLimitations: snapshot.dataLimitations,
  });

  try {
    const snapshotKnowledge = await brandKnowledgeService.getSnapshot(
      scope.brandId,
      scope.organisationId,
      context,
    );
    const brandContext = brandContextBuilder.build(snapshotKnowledge, {});
    const resolvedModel = aiModelRegistry.resolveModel();
    const metricsPayload = {
      overview: snapshot.overview,
      topContent: snapshot.topContent,
      weakContent: snapshot.weakContent,
      leadsCreated: snapshot.leadsCreated,
      dataLimitations: snapshot.dataLimitations,
    };

    const aiResult = await aiRequestService.executeStructured(
      {
        organisationId: scope.organisationId,
        projectId: scope.projectId,
        brandId: scope.brandId,
        userProfileId: context.userProfileId,
        purpose: "ANALYTICS_INSIGHT",
        templateKey: "social.report.narrative",
        schemaKey: "social.report.narrative",
        provider: resolvedModel.provider,
        model: resolvedModel.modelId,
        userInput: [
          "Write an executive social report narrative using only the supplied metrics JSON.",
          "Do not invent statistics or assert causation.",
          "Use hedged language such as 'may be associated with', 'the data suggests', and 'requires further testing'.",
          JSON.stringify(metricsPayload),
        ].join("\n"),
        brandContext,
        requestId,
      },
      context,
    );

    validateSocialReportNarrative(aiResult.output, metricsPayload);
    return {
      narrative: aiResult.output,
      source: "AI",
      aiRequestId: aiResult.aiRequestId,
    };
  } catch {
    return { narrative: deterministic, source: "DETERMINISTIC" };
  }
}

function serializeReport(report: {
  id: string;
  reportType: string;
  title: string;
  status: string;
  periodStart: Date;
  periodEnd: Date;
  timezone: string;
  accountIds: string[];
  enabledSections: SocialReportSectionType[];
  customNotes: string | null;
  includeRecommendations: boolean;
  includeCrescoBranding: boolean;
  narrative: Prisma.JsonValue;
  narrativeSource: string | null;
  dataLimitations: string[];
  shareStatus: string;
  shareExpiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  sections?: Array<{
    id: string;
    sectionType: SocialReportSectionType;
    title: string;
    sortOrder: number;
    content: Prisma.JsonValue;
    notes: string | null;
  }>;
}) {
  return {
    id: report.id,
    reportType: report.reportType,
    title: report.title,
    status: report.status,
    periodStart: report.periodStart.toISOString(),
    periodEnd: report.periodEnd.toISOString(),
    timezone: report.timezone,
    accountIds: report.accountIds,
    enabledSections: report.enabledSections,
    customNotes: report.customNotes,
    includeRecommendations: report.includeRecommendations,
    includeCrescoBranding: report.includeCrescoBranding,
    narrative: report.narrative,
    narrativeSource: report.narrativeSource,
    dataLimitations: report.dataLimitations,
    shareStatus: report.shareStatus,
    shareExpiresAt: report.shareExpiresAt?.toISOString() ?? null,
    createdAt: report.createdAt.toISOString(),
    updatedAt: report.updatedAt.toISOString(),
    sections: report.sections?.map((section) => ({
      id: section.id,
      sectionType: section.sectionType,
      title: section.title,
      sortOrder: section.sortOrder,
      content: section.content,
      notes: section.notes,
    })),
  };
}

function serializeSharedReport(report: {
  title: string;
  reportType: string;
  periodStart: Date;
  periodEnd: Date;
  timezone: string;
  includeCrescoBranding: boolean;
  narrative: Prisma.JsonValue;
  dataLimitations: string[];
  sections?: Array<{
    sectionType: SocialReportSectionType;
    title: string;
    content: Prisma.JsonValue;
  }>;
}) {
  return {
    title: report.title,
    reportType: report.reportType,
    periodStart: report.periodStart.toISOString(),
    periodEnd: report.periodEnd.toISOString(),
    timezone: report.timezone,
    includeCrescoBranding: report.includeCrescoBranding,
    narrative: report.narrative,
    dataLimitations: report.dataLimitations,
    sections:
      report.sections?.map((section) => ({
        sectionType: section.sectionType,
        title: section.title,
        content: section.content,
      })) ?? [],
  };
}

export const socialReportService = {
  async list(brandId: string, organisationId: string, context: TenantContext) {
    const scope = await resolveBrandScope(brandId, organisationId, context);
    const reports = await prisma.socialReport.findMany({
      where: {
        organisationId: scope.organisationId,
        brandId: scope.brandId,
        archivedAt: null,
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return reports.map(serializeReport);
  },

  async get(brandId: string, organisationId: string, reportId: string, context: TenantContext) {
    const scope = await resolveBrandScope(brandId, organisationId, context);
    const report = await prisma.socialReport.findFirst({
      where: {
        id: reportId,
        organisationId: scope.organisationId,
        brandId: scope.brandId,
        archivedAt: null,
      },
      include: {
        sections: { orderBy: { sortOrder: "asc" } },
        snapshots: { orderBy: { generatedAt: "desc" }, take: 1 },
        exports: { orderBy: { createdAt: "desc" }, take: 5 },
        recipients: { where: { removedAt: null } },
      },
    });
    if (!report) {
      throw new AppError("NOT_FOUND", "Report was not found.");
    }
    assertOrganisationScope(report.organisationId, context);
    return {
      ...serializeReport(report),
      latestSnapshot: report.snapshots[0]?.snapshotData ?? null,
      exports: report.exports,
      recipients: report.recipients,
    };
  },

  async create(
    brandId: string,
    organisationId: string,
    input: SocialReportCreateInput,
    context: TenantContext,
    requestId?: string,
  ) {
    const scope = await resolveBrandScope(brandId, organisationId, context);
    const enabledSections = input.enabledSections ?? [...DEFAULT_REPORT_SECTIONS];
    const selectedMetrics = input.selectedMetrics ?? [...DEFAULT_SELECTED_METRICS];

    const report = await prisma.socialReport.create({
      data: {
        organisationId: scope.organisationId,
        projectId: scope.projectId,
        brandId: scope.brandId,
        reportType: input.reportType,
        title: input.title,
        status: "GENERATING",
        periodStart: new Date(input.periodStart),
        periodEnd: new Date(input.periodEnd),
        timezone: input.timezone,
        accountIds: input.accountIds ?? [],
        enabledSections,
        selectedMetrics,
        customNotes: input.customNotes || null,
        includeRecommendations: input.includeRecommendations ?? true,
        includeCrescoBranding: input.includeCrescoBranding ?? true,
        createdByUserId: context.userProfileId,
      },
    });

    try {
      const snapshot = await buildReportSnapshot(scope, input, context);
      const sections: Array<{
        socialReportId: string;
        sectionType: SocialReportSectionType;
        title: string;
        sortOrder: number;
        content: Prisma.InputJsonValue;
        notes: string | null;
      }> = enabledSections.map((sectionType, index) => ({
        socialReportId: report.id,
        sectionType,
        title: SECTION_TYPE_LABELS[sectionType],
        sortOrder: index,
        content: sectionContent(sectionType, snapshot, input) as Prisma.InputJsonValue,
        notes: sectionType === "CUSTOM_NOTES" ? input.customNotes ?? null : null,
      }));

      let narrative: SocialReportNarrative | null = null;
      let narrativeSource: string | null = null;
      let aiRequestId: string | undefined;
      if (input.generateNarrative !== false) {
        const narrativeResult = await generateNarrative(scope, snapshot, context, requestId);
        narrative = narrativeResult.narrative;
        narrativeSource = narrativeResult.source;
        aiRequestId = narrativeResult.aiRequestId;
        sections.push({
          socialReportId: report.id,
          sectionType: "AI_NARRATIVE",
          title: SECTION_TYPE_LABELS.AI_NARRATIVE,
          sortOrder: sections.length,
          content: narrative as Prisma.InputJsonValue,
          notes: null,
        });
      }

      await prisma.$transaction([
        prisma.socialReportSnapshot.create({
          data: {
            socialReportId: report.id,
            snapshotData: snapshot as Prisma.InputJsonValue,
          },
        }),
        prisma.socialReportSection.createMany({ data: sections }),
        prisma.socialReport.update({
          where: { id: report.id },
          data: {
            status: "READY",
            narrative: narrative as Prisma.InputJsonValue,
            narrativeSource,
            aiRequestId,
            dataLimitations: snapshot.dataLimitations,
          },
        }),
      ]);

      await recordAuditEvent({
        organisationId: scope.organisationId,
        actorUserId: context.userProfileId,
        action: "analytics.report.create",
        resourceType: "SocialReport",
        resourceId: report.id,
        metadata: { reportType: input.reportType, title: input.title },
      });

      return this.get(brandId, organisationId, report.id, context);
    } catch (error) {
      await prisma.socialReport.update({
        where: { id: report.id },
        data: { status: "FAILED" },
      });
      throw error;
    }
  },

  async updateShare(
    brandId: string,
    organisationId: string,
    reportId: string,
    enable: boolean,
    expiresInDays: number | undefined,
    context: TenantContext,
  ) {
    const scope = await resolveBrandScope(brandId, organisationId, context);
    const report = await prisma.socialReport.findFirst({
      where: {
        id: reportId,
        organisationId: scope.organisationId,
        brandId: scope.brandId,
        archivedAt: null,
      },
    });
    if (!report) {
      throw new AppError("NOT_FOUND", "Report was not found.");
    }

    if (!enable) {
      await prisma.socialReport.update({
        where: { id: reportId },
        data: { shareStatus: "REVOKED", shareToken: null, shareExpiresAt: null },
      });
      return { shareStatus: "REVOKED" };
    }

    const token = randomBytes(SHARE_TOKEN_BYTES).toString("hex");
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + (expiresInDays ?? DEFAULT_SHARE_EXPIRY_DAYS));

    await prisma.socialReport.update({
      where: { id: reportId },
      data: {
        shareToken: token,
        shareStatus: "ACTIVE",
        shareExpiresAt: expiresAt,
      },
    });

    return {
      shareStatus: "ACTIVE",
      shareToken: token,
      shareExpiresAt: expiresAt.toISOString(),
      sharePath: `/reports/shared/${token}`,
    };
  },

  async getByShareToken(token: string) {
    const report = await prisma.socialReport.findFirst({
      where: { shareToken: token, shareStatus: "ACTIVE", archivedAt: null },
      include: {
        sections: { orderBy: { sortOrder: "asc" } },
        snapshots: { orderBy: { generatedAt: "desc" }, take: 1 },
      },
    });
    if (!report) {
      throw new AppError("NOT_FOUND", "Shared report was not found.");
    }
    if (report.shareExpiresAt && report.shareExpiresAt.getTime() < Date.now()) {
      await prisma.socialReport.update({
        where: { id: report.id },
        data: { shareStatus: "EXPIRED" },
      });
      throw new AppError("FORBIDDEN", "Shared report link has expired.");
    }
    return {
      ...serializeSharedReport(report),
      latestSnapshot: report.snapshots[0]?.snapshotData ?? null,
    };
  },

  async exportReport(
    brandId: string,
    organisationId: string,
    reportId: string,
    format: SocialReportExportFormat,
    context: TenantContext,
  ) {
    const report = await this.get(brandId, organisationId, reportId, context);
    const exportRecord = await prisma.socialReportExport.create({
      data: {
        socialReportId: reportId,
        format,
        status: "PENDING",
      },
    });

    try {
      if (format === "JSON") {
        const body = JSON.stringify(report, null, 2);
        await prisma.socialReportExport.update({
          where: { id: exportRecord.id },
          data: {
            status: "COMPLETED",
            fileName: `${report.title}.json`,
            mimeType: "application/json",
            completedAt: new Date(),
          },
        });
        return {
          format,
          fileName: `${report.title}.json`,
          mimeType: "application/json",
          body,
        };
      }

      if (format === "CSV") {
        const rows: string[][] = [["section", "metric", "value"]];
        for (const section of report.sections ?? []) {
          rows.push([section.sectionType, "title", section.title]);
          rows.push([
            section.sectionType,
            "content",
            JSON.stringify(section.content).replaceAll('"', '""'),
          ]);
        }
        const csv = rows
          .map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(","))
          .join("\n");
        await prisma.socialReportExport.update({
          where: { id: exportRecord.id },
          data: {
            status: "COMPLETED",
            fileName: `${report.title}.csv`,
            mimeType: "text/csv",
            rowCount: rows.length,
            completedAt: new Date(),
          },
        });
        return {
          format,
          fileName: `${report.title}.csv`,
          mimeType: "text/csv",
          body: csv,
        };
      }

      const pdfBuffer = await new Promise<Buffer>((resolve, reject) => {
        const document = new PDFDocument({ margin: 48 });
        const chunks: Buffer[] = [];
        document.on("data", (chunk: Buffer) => chunks.push(chunk));
        document.on("end", () => resolve(Buffer.concat(chunks)));
        document.on("error", reject);

        if (report.includeCrescoBranding) {
          document.fontSize(10).fillColor("#64748b").text("Cresco Marketing Intelligence");
          document.moveDown(0.5);
        }
        document.fontSize(18).fillColor("#0f172a").text(report.title);
        document
          .fontSize(10)
          .fillColor("#334155")
          .text(
            `${new Date(report.periodStart).toLocaleDateString()} – ${new Date(report.periodEnd).toLocaleDateString()} (${report.timezone})`,
          );
        document.moveDown();

        for (const section of report.sections ?? []) {
          document.fontSize(13).fillColor("#0f172a").text(section.title);
          document
            .fontSize(9)
            .fillColor("#334155")
            .text(JSON.stringify(section.content, null, 2), { width: 500 });
          document.moveDown();
        }

        if (report.dataLimitations.length > 0) {
          document.fontSize(12).fillColor("#0f172a").text("Data limitations");
          for (const limitation of report.dataLimitations) {
            document.fontSize(9).fillColor("#334155").text(`• ${limitation}`);
          }
        }
        document.end();
      });

      await prisma.socialReportExport.update({
        where: { id: exportRecord.id },
        data: {
          status: "COMPLETED",
          fileName: `${report.title}.pdf`,
          mimeType: "application/pdf",
          completedAt: new Date(),
        },
      });

      return {
        format,
        fileName: `${report.title}.pdf`,
        mimeType: "application/pdf",
        body: pdfBuffer.toString("base64"),
        encoding: "base64" as const,
      };
    } catch (error) {
      await prisma.socialReportExport.update({
        where: { id: exportRecord.id },
        data: { status: "FAILED", metadata: { error: String(error) } },
      });
      throw error;
    }
  },

  async createSchedule(
    brandId: string,
    organisationId: string,
    input: SocialReportScheduleInput,
    context: TenantContext,
  ) {
    const scope = await resolveBrandScope(brandId, organisationId, context);
    const recipientUserIds = input.recipientUserIds ?? [];
    await assertRecipientsAreMembers(scope.organisationId, recipientUserIds);

    const nextRunAt = new Date();
    if (input.cadence === "WEEKLY") nextRunAt.setDate(nextRunAt.getDate() + 7);
    if (input.cadence === "MONTHLY") nextRunAt.setMonth(nextRunAt.getMonth() + 1);

    const schedule = await prisma.$transaction(async (tx) => {
      const created = await tx.socialReportSchedule.create({
        data: {
          organisationId: scope.organisationId,
          projectId: scope.projectId,
          brandId: scope.brandId,
          reportType: input.reportType,
          cadence: input.cadence,
          timezone: input.timezone,
          accountIds: input.accountIds ?? [],
          enabledSections: input.enabledSections ?? [...DEFAULT_REPORT_SECTIONS],
          includeRecommendations: input.includeRecommendations ?? true,
          includeCrescoBranding: input.includeCrescoBranding ?? true,
          nextRunAt,
          createdByUserId: context.userProfileId,
        },
      });

      const recipients = [
        ...input.recipientEmails.map((email) => ({ scheduleId: created.id, email, userId: null as string | null })),
        ...recipientUserIds.map((userId) => ({ scheduleId: created.id, userId, email: null as string | null })),
      ];

      for (const recipient of recipients) {
        let email = recipient.email;
        if (!email && recipient.userId) {
          const user = await tx.userProfile.findUnique({
            where: { id: recipient.userId },
            select: { email: true },
          });
          email = user?.email ?? `${recipient.userId}@unknown`;
        }
        if (!email) continue;
        await tx.socialReportRecipient.create({
          data: {
            scheduleId: created.id,
            userId: recipient.userId,
            email,
          },
        });
      }

      return created;
    });

    return schedule;
  },

  async listSchedules(brandId: string, organisationId: string, context: TenantContext) {
    const scope = await resolveBrandScope(brandId, organisationId, context);
    return prisma.socialReportSchedule.findMany({
      where: { organisationId: scope.organisationId, brandId: scope.brandId, isActive: true },
      include: {
        recipients: { where: { removedAt: null } },
      },
      orderBy: { createdAt: "desc" },
    });
  },

  async processDueSchedules(now = new Date()) {
    const due = await prisma.socialReportSchedule.findMany({
      where: { isActive: true, nextRunAt: { lte: now } },
      include: { recipients: { where: { removedAt: null } } },
      take: 20,
    });

    const results = [];
    for (const schedule of due) {
      const context: TenantContext = {
        userId: schedule.createdByUserId,
        userProfileId: schedule.createdByUserId,
        organisationId: schedule.organisationId,
        organisationRole: "ADMIN",
      };
      const periodEnd = now;
      const periodStart = new Date(now);
      if (schedule.cadence === "WEEKLY") periodStart.setDate(periodStart.getDate() - 7);
      else if (schedule.cadence === "MONTHLY") periodStart.setMonth(periodStart.getMonth() - 1);
      else periodStart.setDate(periodStart.getDate() - 30);

      const report = await this.create(
        schedule.brandId,
        schedule.organisationId,
        {
          reportType: schedule.reportType,
          title: `${schedule.reportType} scheduled report`,
          periodStart: periodStart.toISOString(),
          periodEnd: periodEnd.toISOString(),
          timezone: schedule.timezone,
          accountIds: schedule.accountIds,
          enabledSections: schedule.enabledSections,
          includeRecommendations: schedule.includeRecommendations,
          includeCrescoBranding: schedule.includeCrescoBranding,
          generateNarrative: true,
        },
        context,
      );

      for (const recipient of schedule.recipients) {
        await prisma.socialReportRecipient.create({
          data: {
            reportId: report.id,
            email: recipient.email,
            userId: recipient.userId,
          },
        });
      }

      const nextRunAt = new Date(now);
      if (schedule.cadence === "WEEKLY") nextRunAt.setDate(nextRunAt.getDate() + 7);
      if (schedule.cadence === "MONTHLY") nextRunAt.setMonth(nextRunAt.getMonth() + 1);

      await prisma.socialReportSchedule.update({
        where: { id: schedule.id },
        data: { lastRunAt: now, nextRunAt },
      });

      results.push({ scheduleId: schedule.id, reportId: report.id });
    }

    return results;
  },
};

export function hashShareToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
