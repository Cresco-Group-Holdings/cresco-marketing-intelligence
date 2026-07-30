import { NextRequest } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { apiSuccess } from "@/lib/api/response";
import { requireOrganisationId, withSeoSitesRead } from "@/lib/api/seo-handler";
import { brandService } from "@/server/services/workspace-service";

type Params = { params: Promise<{ brandId: string; siteId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { brandId, siteId } = await params;
  const organisationId = requireOrganisationId(request);
  const severity = request.nextUrl.searchParams.get("severity") ?? undefined;
  const status = request.nextUrl.searchParams.get("status") ?? undefined;
  const crawlRunId = request.nextUrl.searchParams.get("crawlRunId") ?? undefined;

  return withSeoSitesRead(request, organisationId, async ({ requestId, tenant }) => {
    await brandService.getById(brandId, organisationId, tenant!);
    const issues = await prisma.seoCrawlIssue.findMany({
      where: {
        seoSiteId: siteId,
        organisationId,
        brandId,
        ...(severity ? { severity: severity as never } : {}),
        ...(status ? { status: status as never } : {}),
        ...(crawlRunId ? { crawlRunId } : {}),
      },
      orderBy: [{ severity: "desc" }, { detectedAt: "desc" }],
      take: 500,
    });
    return apiSuccess({ items: issues }, { requestId });
  });
}
