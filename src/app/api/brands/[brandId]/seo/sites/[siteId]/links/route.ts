import { NextRequest } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { apiSuccess } from "@/lib/api/response";
import { requireOrganisationId, withSeoSitesRead } from "@/lib/api/seo-handler";
import { brandService } from "@/server/services/workspace-service";

type Params = { params: Promise<{ brandId: string; siteId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { brandId, siteId } = await params;
  const organisationId = requireOrganisationId(request);
  const crawlRunId = request.nextUrl.searchParams.get("crawlRunId") ?? undefined;

  return withSeoSitesRead(request, organisationId, async ({ requestId, tenant }) => {
    await brandService.getById(brandId, organisationId, tenant!);
    const links = await prisma.seoCrawlLink.findMany({
      where: {
        seoSiteId: siteId,
        organisationId,
        ...(crawlRunId ? { crawlRunId } : {}),
      },
      take: 500,
      orderBy: { lastSeenAt: "desc" },
    });
    return apiSuccess({ items: links }, { requestId });
  });
}
