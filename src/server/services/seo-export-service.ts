import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";
import type { TenantContext } from "@/lib/tenancy/context";
import { brandService } from "@/server/services/workspace-service";

function csvEscape(value: unknown): string {
  const str = value == null ? "" : String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toCsv(headers: string[], rows: Array<Record<string, unknown>>): string {
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => csvEscape(row[h])).join(","));
  }
  return lines.join("\n");
}

export const seoExportService = {
  async exportPages(
    siteId: string,
    brandId: string,
    organisationId: string,
    context: TenantContext,
    crawlRunId?: string,
  ) {
    await brandService.getById(brandId, organisationId, context);
    const pages = await prisma.seoCrawlPage.findMany({
      where: { seoSiteId: siteId, organisationId, brandId },
      include: {
        snapshots: crawlRunId
          ? { where: { crawlRunId }, take: 1, orderBy: { createdAt: "desc" } }
          : { take: 1, orderBy: { createdAt: "desc" } },
      },
    });

    const rows = pages.map((p) => {
      const snap = p.snapshots[0];
      return {
        url: p.normalisedUrl,
        path: p.path ?? "",
        statusCode: snap?.statusCode ?? p.lastStatusCode ?? "",
        title: snap?.title ?? "",
        description: snap?.description ?? "",
        canonical: snap?.canonicalUrl ?? "",
        wordCount: snap?.wordCount ?? "",
        lastSeen: p.lastSeenAt.toISOString(),
      };
    });

    return toCsv(
      ["url", "path", "statusCode", "title", "description", "canonical", "wordCount", "lastSeen"],
      rows,
    );
  },

  async exportIssues(
    siteId: string,
    brandId: string,
    organisationId: string,
    context: TenantContext,
    crawlRunId?: string,
  ) {
    await brandService.getById(brandId, organisationId, context);
    const issues = await prisma.seoCrawlIssue.findMany({
      where: {
        seoSiteId: siteId,
        organisationId,
        brandId,
        ...(crawlRunId ? { crawlRunId } : {}),
      },
      orderBy: [{ severity: "desc" }, { detectedAt: "desc" }],
    });

    const rows = issues.map((i) => ({
      ruleId: i.ruleId,
      severity: i.severity,
      status: i.status,
      affectedUrl: i.affectedUrl,
      explanation: i.explanation,
      recommendedAction: i.recommendedAction ?? "",
      detectedAt: i.detectedAt.toISOString(),
    }));

    return toCsv(
      ["ruleId", "severity", "status", "affectedUrl", "explanation", "recommendedAction", "detectedAt"],
      rows,
    );
  },

  async exportLinks(
    siteId: string,
    brandId: string,
    organisationId: string,
    context: TenantContext,
    crawlRunId?: string,
  ) {
    await brandService.getById(brandId, organisationId, context);
    const links = await prisma.seoCrawlLink.findMany({
      where: {
        seoSiteId: siteId,
        organisationId,
        linkType: "INTERNAL",
        ...(crawlRunId ? { crawlRunId } : {}),
      },
    });

    const rows = links.map((l) => ({
      sourceUrl: l.sourceUrl,
      destinationUrl: l.destinationUrl,
      anchorText: l.anchorText ?? "",
      rel: l.rel ?? "",
      isFollowed: l.isFollowed,
      statusCode: l.statusCode ?? "",
    }));

    return toCsv(
      ["sourceUrl", "destinationUrl", "anchorText", "rel", "isFollowed", "statusCode"],
      rows,
    );
  },

  async exportCrawlSummary(
    runId: string,
    brandId: string,
    organisationId: string,
    context: TenantContext,
  ) {
    await brandService.getById(brandId, organisationId, context);
    const run = await prisma.seoCrawlRun.findFirst({
      where: { id: runId, organisationId, brandId },
      include: {
        _count: { select: { snapshots: true, issues: true, links: true, queueItems: true } },
      },
    });
    if (!run) throw new AppError("NOT_FOUND", "Crawl run not found.");

    return JSON.stringify(
      {
        runId: run.id,
        status: run.status,
        pagesDiscovered: run.pagesDiscovered,
        pagesCrawled: run.pagesCrawled,
        pagesBlocked: run.pagesBlocked,
        issuesFound: run.issuesFound,
        startedAt: run.startedAt,
        completedAt: run.completedAt,
        counts: run._count,
      },
      null,
      2,
    );
  },
};
