import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/response";
import { prisma } from "@/lib/database/prisma";
import {
  requireOrganisationId,
  withCompetitorsRead,
} from "@/lib/api/competitors-handler";
import { brandService } from "@/server/services/workspace-service";

type Params = { params: Promise<{ brandId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { brandId } = await params;
  const organisationId = requireOrganisationId(request);
  const competitorId = request.nextUrl.searchParams.get("competitorId") ?? undefined;
  return withCompetitorsRead(request, organisationId, async ({ requestId, tenant }) => {
    await brandService.getById(brandId, organisationId, tenant!);
    const items = await prisma.seoCompetitorKeyword.findMany({
      where: {
        organisationId,
        ...(competitorId
          ? { competitorId }
          : { competitor: { brandId, status: "ACTIVE" } }),
      },
      include: { competitor: { select: { id: true, name: true } } },
      orderBy: { observedAt: "desc" },
      take: 200,
    });
    return apiSuccess({ items }, { requestId });
  });
}
