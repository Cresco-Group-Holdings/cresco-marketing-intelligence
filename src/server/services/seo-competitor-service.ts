import { createHash } from "node:crypto";
import type { Prisma, SeoCompetitorType } from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";
import { validateCompetitorDomain } from "@/lib/competitors/crawl-policy";
import type { TenantContext } from "@/lib/tenancy/context";
import { brandService } from "@/server/services/workspace-service";

function normaliseHostname(hostname: string): string {
  return hostname.toLowerCase().replace(/\.$/, "").replace(/^https?:\/\//, "").split("/")[0] ?? hostname;
}

export const seoCompetitorService = {
  async list(
    brandId: string,
    organisationId: string,
    filters: { status?: "ACTIVE" | "ARCHIVED"; competitorType?: SeoCompetitorType; search?: string; limit?: number },
    context: TenantContext,
  ) {
    await brandService.getById(brandId, organisationId, context);
    return prisma.seoCompetitor.findMany({
      where: {
        organisationId,
        brandId,
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.competitorType ? { competitorType: filters.competitorType } : {}),
        ...(filters.search ? { name: { contains: filters.search, mode: "insensitive" } } : {}),
      },
      include: {
        domains: true,
        _count: { select: { pages: true, keywords: true, contentGaps: true, snapshots: true } },
      },
      orderBy: { name: "asc" },
      take: filters.limit ?? 50,
    });
  },

  async getById(competitorId: string, brandId: string, organisationId: string, context: TenantContext) {
    await brandService.getById(brandId, organisationId, context);
    const competitor = await prisma.seoCompetitor.findFirst({
      where: { id: competitorId, organisationId, brandId },
      include: {
        domains: true,
        pages: { take: 50, orderBy: { observedAt: "desc" } },
        keywords: { take: 50, orderBy: { observedAt: "desc" } },
        topics: true,
        contentGaps: { where: { status: "OPEN" }, take: 20 },
        snapshots: { take: 5, orderBy: { createdAt: "desc" } },
        _count: { select: { pages: true, keywords: true, comparisons: true } },
      },
    });
    if (!competitor) throw new AppError("NOT_FOUND", "Competitor not found.");
    return competitor;
  },

  async create(
    brandId: string,
    organisationId: string,
    input: { name: string; domain: string; competitorType: SeoCompetitorType; notes?: string },
    context: TenantContext,
  ) {
    const brand = await brandService.getById(brandId, organisationId, context);
    const hostname = normaliseHostname(input.domain);
    const validation = validateCompetitorDomain(hostname);
    if (!validation.valid) throw new AppError("VALIDATION_ERROR", validation.reason ?? "Invalid domain.");

    const existing = await prisma.seoCompetitor.findUnique({
      where: { brandId_name: { brandId, name: input.name } },
    });
    if (existing) throw new AppError("VALIDATION_ERROR", "Competitor with this name already exists.");

    return prisma.seoCompetitor.create({
      data: {
        organisationId,
        projectId: brand.projectId,
        brandId,
        name: input.name,
        competitorType: input.competitorType,
        notes: input.notes,
        domains: {
          create: {
            organisationId,
            hostname,
            isPrimary: true,
          },
        },
      },
      include: { domains: true },
    });
  },

  async update(
    competitorId: string,
    brandId: string,
    organisationId: string,
    input: { name?: string; competitorType?: SeoCompetitorType; notes?: string; status?: "ACTIVE" | "ARCHIVED" },
    context: TenantContext,
  ) {
    await this.getById(competitorId, brandId, organisationId, context);
    return prisma.seoCompetitor.update({
      where: { id: competitorId },
      data: {
        ...input,
        archivedAt: input.status === "ARCHIVED" ? new Date() : input.status === "ACTIVE" ? null : undefined,
      },
      include: { domains: true },
    });
  },

  async addKeyword(
    competitorId: string,
    brandId: string,
    organisationId: string,
    input: {
      keyword: string;
      source: string;
      position?: number;
      rankingUrl?: string;
      provider?: string;
      observedAt?: Date;
    },
    context: TenantContext,
  ) {
    await this.getById(competitorId, brandId, organisationId, context);
    const normalised = input.keyword.toLowerCase().trim();
    const observedAt = input.observedAt ?? new Date();
    return prisma.seoCompetitorKeyword.create({
      data: {
        organisationId,
        competitorId,
        keyword: input.keyword,
        normalisedKeyword: normalised,
        source: input.source,
        observedAt,
        position: input.position,
        rankingUrl: input.rankingUrl,
        provider: input.provider,
        isManual: input.source === "MANUAL",
      },
    });
  },
};
