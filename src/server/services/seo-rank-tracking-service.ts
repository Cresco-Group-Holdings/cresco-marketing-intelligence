import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";
import { DEFAULT_KEYWORD_QUOTA } from "@/lib/rank-tracking/constants";
import { summariseRankHistory } from "@/lib/rank-tracking/rank-history";
import type { TenantContext } from "@/lib/tenancy/context";
import { brandService } from "@/server/services/workspace-service";

export const seoRankTrackingService = {
  async listProjects(brandId: string, organisationId: string, context: TenantContext) {
    await brandService.getById(brandId, organisationId, context);
    return prisma.seoRankTrackingProject.findMany({
      where: { organisationId, brandId },
      include: {
        seoSite: { select: { id: true, name: true, primaryDomain: true } },
        _count: { select: { trackedKeywords: true, rankChanges: true, refreshCandidates: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 20,
    });
  },

  async getProject(projectId: string, brandId: string, organisationId: string, context: TenantContext) {
    await brandService.getById(brandId, organisationId, context);
    const project = await prisma.seoRankTrackingProject.findFirst({
      where: { id: projectId, organisationId, brandId },
      include: {
        seoSite: true,
        trackedKeywords: {
          where: { status: "ACTIVE" },
          orderBy: { priority: "desc" },
          take: 200,
          include: {
            targetPage: { select: { id: true, normalisedUrl: true } },
            observations: { orderBy: { observedDate: "desc" }, take: 30 },
            rankingUrls: { orderBy: { lastSeenAt: "desc" }, take: 5 },
          },
        },
        rankChanges: { where: { isAlert: true }, orderBy: { detectedAt: "desc" }, take: 50 },
        _count: { select: { trackedKeywords: true, refreshCandidates: true } },
      },
    });
    if (!project) throw new AppError("NOT_FOUND", "Rank tracking project not found.");
    return project;
  },

  async createProject(
    brandId: string,
    organisationId: string,
    userId: string,
    input: { seoSiteId: string; name: string; keywordQuota?: number },
    context: TenantContext,
  ) {
    const brand = await brandService.getById(brandId, organisationId, context);
    const site = await prisma.seoSite.findFirst({ where: { id: input.seoSiteId, brandId, organisationId } });
    if (!site) throw new AppError("NOT_FOUND", "SEO site not found.");

    return prisma.seoRankTrackingProject.create({
      data: {
        organisationId,
        projectId: brand.projectId,
        brandId,
        seoSiteId: input.seoSiteId,
        name: input.name,
        keywordQuota: input.keywordQuota ?? DEFAULT_KEYWORD_QUOTA,
        createdByUserId: userId,
        alertSettings: { cooldownHours: 24, minImpressions: 50 },
      },
    });
  },

  async addTrackedKeyword(
    projectId: string,
    brandId: string,
    organisationId: string,
    input: {
      keyword: string;
      keywordId?: string;
      targetPageId?: string;
      country?: string;
      language?: string;
      device?: "DESKTOP" | "MOBILE" | "TABLET" | "ALL";
      schedule?: "DAILY" | "WEEKLY" | "MANUAL";
      priority?: number;
      tags?: string[];
    },
    context: TenantContext,
  ) {
    const project = await this.getProject(projectId, brandId, organisationId, context);
    if (project.keywordCount >= project.keywordQuota) {
      throw new AppError("VALIDATION_ERROR", `Keyword quota of ${project.keywordQuota} reached.`);
    }

    const keyword = await prisma.seoTrackedKeyword.create({
      data: {
        organisationId,
        projectId: project.projectId,
        brandId,
        trackingProjectId: projectId,
        keyword: input.keyword,
        keywordId: input.keywordId,
        targetPageId: input.targetPageId,
        country: input.country ?? "US",
        language: input.language ?? "en",
        device: input.device ?? "ALL",
        schedule: input.schedule ?? "WEEKLY",
        priority: input.priority ?? 50,
        tags: input.tags ?? [],
      },
    });

    await prisma.seoRankTrackingProject.update({
      where: { id: projectId },
      data: { keywordCount: { increment: 1 } },
    });

    return keyword;
  },

  async getKeywordHistory(
    trackedKeywordId: string,
    brandId: string,
    organisationId: string,
    context: TenantContext,
  ) {
    await brandService.getById(brandId, organisationId, context);
    const keyword = await prisma.seoTrackedKeyword.findFirst({
      where: { id: trackedKeywordId, organisationId, brandId },
      include: {
        observations: { orderBy: { observedDate: "asc" }, include: { rankingUrl: true } },
        rankingUrls: true,
        rankChanges: { orderBy: { detectedAt: "desc" }, take: 20 },
        targetPage: true,
      },
    });
    if (!keyword) throw new AppError("NOT_FOUND", "Tracked keyword not found.");

    const history = summariseRankHistory(
      keyword.observations.map((o) => ({
        observedDate: o.observedDate.toISOString().slice(0, 10),
        rank: o.rank,
        url: o.rankingUrl?.url,
        impressions: o.impressions,
        clicks: o.clicks,
        ctr: o.ctr,
      })),
    );

    return { keyword, history };
  },

  async listRankChanges(projectId: string, brandId: string, organisationId: string, context: TenantContext) {
    await this.getProject(projectId, brandId, organisationId, context);
    return prisma.seoRankChange.findMany({
      where: { trackingProjectId: projectId, organisationId },
      include: { trackedKeyword: { select: { keyword: true, country: true, device: true } } },
      orderBy: { detectedAt: "desc" },
      take: 100,
    });
  },

  async listPagesWithRankings(projectId: string, brandId: string, organisationId: string, context: TenantContext) {
    await this.getProject(projectId, brandId, organisationId, context);
    return prisma.seoRankingUrl.findMany({
      where: {
        organisationId,
        trackedKeyword: { trackingProjectId: projectId, brandId },
      },
      include: {
        trackedKeyword: { select: { keyword: true } },
        crawlPage: { select: { id: true, normalisedUrl: true } },
      },
      orderBy: { lastSeenAt: "desc" },
      take: 200,
    });
  },
};
