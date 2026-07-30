import { NextRequest } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { apiSuccess } from "@/lib/api/response";
import { requireOrganisationId, withSeoSitesRead } from "@/lib/api/seo-handler";
import { brandService } from "@/server/services/workspace-service";

type Params = { params: Promise<{ brandId: string; siteId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { brandId, siteId } = await params;
  const organisationId = requireOrganisationId(request);
  return withSeoSitesRead(request, organisationId, async ({ requestId, tenant }) => {
    await brandService.getById(brandId, organisationId, tenant!);
    const pages = await prisma.seoCrawlPage.findMany({
      where: { seoSiteId: siteId, organisationId, brandId },
      include: {
        snapshots: { take: 1, orderBy: { createdAt: "desc" } },
        _count: { select: { issues: true } },
      },
      orderBy: { lastSeenAt: "desc" },
      take: 200,
    });
    return apiSuccess({ items: pages }, { requestId });
  });
}
