import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { apiSuccess } from "@/lib/api/response";
import { requireOrganisationId, withSeoCrawlsExport, withSeoSitesRead } from "@/lib/api/seo-handler";
import { compareCrawlRuns } from "@/lib/seo/crawl-comparison";
import { seoExportService } from "@/server/services/seo-export-service";
import { brandService } from "@/server/services/workspace-service";

type Params = { params: Promise<{ brandId: string; siteId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { brandId, siteId } = await params;
  const organisationId = requireOrganisationId(request);
  const type = request.nextUrl.searchParams.get("type") ?? "pages";
  const crawlRunId = request.nextUrl.searchParams.get("crawlRunId") ?? undefined;

  return withSeoCrawlsExport(request, organisationId, async ({ requestId, tenant }) => {
    let content: string;
    let contentType = "text/csv";

    if (type === "issues") {
      content = await seoExportService.exportIssues(siteId, brandId, organisationId, tenant!, crawlRunId);
    } else if (type === "links") {
      content = await seoExportService.exportLinks(siteId, brandId, organisationId, tenant!, crawlRunId);
    } else if (type === "summary" && crawlRunId) {
      content = await seoExportService.exportCrawlSummary(crawlRunId, brandId, organisationId, tenant!);
      contentType = "application/json";
    } else {
      content = await seoExportService.exportPages(siteId, brandId, organisationId, tenant!, crawlRunId);
    }

    return new NextResponse(content, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="seo-${type}-${siteId}.csv"`,
        "x-request-id": requestId,
      },
    });
  });
}

export async function POST(request: NextRequest, { params }: Params) {
  const { brandId, siteId } = await params;
  const organisationId = requireOrganisationId(request);
  const body = await request.json();
  const baselineRunId = body.baselineRunId as string;
  const currentRunId = body.currentRunId as string;

  return withSeoSitesRead(request, organisationId, async ({ requestId, tenant }) => {
    await brandService.getById(brandId, organisationId, tenant!);

    const [baselineSnaps, currentSnaps] = await Promise.all([
      prisma.seoPageSnapshot.findMany({
        where: { crawlRunId: baselineRunId, seoSiteId: siteId },
        include: { page: { select: { normalisedUrl: true } } },
      }),
      prisma.seoPageSnapshot.findMany({
        where: { crawlRunId: currentRunId, seoSiteId: siteId },
        include: { page: { select: { normalisedUrl: true } } },
      }),
    ]);

    const [baselineIssues, currentIssues] = await Promise.all([
      prisma.seoCrawlIssue.count({ where: { crawlRunId: baselineRunId } }),
      prisma.seoCrawlIssue.count({ where: { crawlRunId: currentRunId } }),
    ]);

    const comparison = compareCrawlRuns(
      baselineSnaps.map((s) => ({
        pageId: s.pageId,
        normalisedUrl: s.page.normalisedUrl,
        statusCode: s.statusCode,
        title: s.title,
        description: s.description,
        canonicalUrl: s.canonicalUrl,
        robotsDirective: s.robotsDirective,
        contentHash: s.contentHash,
      })),
      currentSnaps.map((s) => ({
        pageId: s.pageId,
        normalisedUrl: s.page.normalisedUrl,
        statusCode: s.statusCode,
        title: s.title,
        description: s.description,
        canonicalUrl: s.canonicalUrl,
        robotsDirective: s.robotsDirective,
        contentHash: s.contentHash,
      })),
      baselineIssues,
      currentIssues,
    );

    return apiSuccess({ comparison }, { requestId });
  });
}
