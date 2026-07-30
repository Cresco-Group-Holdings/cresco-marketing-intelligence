import { NextRequest } from "next/server";
import { apiSuccess, withApiHandler } from "@/lib/api/handler";
import { PERMISSIONS } from "@/lib/tenancy/permissions";
import { gscDashboardService } from "@/server/services/gsc-dashboard-service";

function parseDateRange(searchParams: URLSearchParams) {
  const toParam = searchParams.get("to");
  const fromParam = searchParams.get("from");
  const days = Number(searchParams.get("days") ?? "28");

  const to = toParam ? new Date(toParam) : new Date();
  const from = fromParam
    ? new Date(fromParam)
    : new Date(to.getTime() - Math.max(1, days) * 86_400_000);

  return { from, to };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ brandId: string }> },
) {
  const { brandId } = await params;
  const organisationId = request.nextUrl.searchParams.get("organisationId");
  const section = request.nextUrl.searchParams.get("section") ?? "overview";

  if (!organisationId) {
    return apiSuccess({ error: "organisation_required" });
  }

  const { from, to } = parseDateRange(request.nextUrl.searchParams);

  return withApiHandler(
    request,
    async ({ tenant, requestId }) => {
      const orgId = tenant!.organisationId;
      const context = tenant!;

      switch (section) {
        case "queries":
          return apiSuccess(
            { queries: await gscDashboardService.getTopQueries(brandId, orgId, from, to, context) },
            { requestId },
          );
        case "pages":
          return apiSuccess(
            { pages: await gscDashboardService.getTopPages(brandId, orgId, from, to, context) },
            { requestId },
          );
        case "opportunities":
          return apiSuccess(
            {
              opportunities: await gscDashboardService.getOpportunities(
                brandId,
                orgId,
                from,
                to,
                context,
              ),
            },
            { requestId },
          );
        case "indexing":
          return apiSuccess(
            { indexing: await gscDashboardService.getIndexing(brandId, orgId, context) },
            { requestId },
          );
        default:
          return apiSuccess(
            { overview: await gscDashboardService.getOverview(brandId, orgId, from, to, context) },
            { requestId },
          );
      }
    },
    { organisationId, permission: PERMISSIONS["connectors.read"] },
  );
}
