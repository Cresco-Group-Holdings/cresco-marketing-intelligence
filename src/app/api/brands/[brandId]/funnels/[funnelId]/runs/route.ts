import { NextRequest } from "next/server";
import { apiSuccess, withApiHandler } from "@/lib/api/handler";
import { PERMISSIONS } from "@/lib/tenancy/permissions";
import { funnelAnalysisService } from "@/server/services/funnel-analysis-service";

function parseDateRange(searchParams: URLSearchParams) {
  const toParam = searchParams.get("to");
  const fromParam = searchParams.get("from");
  const days = Number(searchParams.get("days") ?? "28");
  const to = toParam ? new Date(toParam) : new Date();
  const from = fromParam ? new Date(fromParam) : new Date(to.getTime() - Math.max(1, days) * 86_400_000);
  return { from, to };
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ brandId: string; funnelId: string }> },
) {
  const { brandId, funnelId } = await params;
  const organisationId = request.nextUrl.searchParams.get("organisationId");
  if (!organisationId) return apiSuccess({ error: "organisation_required" });

  const body = (await request.json()) as {
    from?: string;
    to?: string;
    cohortDate?: string;
    segmentDimension?: string;
  };

  const { from, to } = parseDateRange(request.nextUrl.searchParams);

  return withApiHandler(
    request,
    async ({ tenant, requestId }) => {
      const run = await funnelAnalysisService.runAnalysis(
        brandId,
        organisationId,
        funnelId,
        {
          from: body.from ? new Date(body.from) : from,
          to: body.to ? new Date(body.to) : to,
          cohortDate: body.cohortDate ? new Date(body.cohortDate) : undefined,
          segmentDimension: body.segmentDimension,
        },
        tenant!,
      );
      return apiSuccess({ run }, { requestId });
    },
    { organisationId, permission: PERMISSIONS["marketingData.reprocess"] },
  );
}
