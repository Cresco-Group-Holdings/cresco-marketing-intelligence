import { NextRequest } from "next/server";
import { apiSuccess, withApiHandler } from "@/lib/api/handler";
import { PERMISSIONS } from "@/lib/tenancy/permissions";
import { attributionDashboardService } from "@/server/services/attribution-dashboard-service";

const VALID_SECTIONS = ["overview", "journeys", "conversions", "compare", "models", "warnings"] as const;

function parseDateRange(searchParams: URLSearchParams) {
  const toParam = searchParams.get("to");
  const fromParam = searchParams.get("from");
  const days = Number(searchParams.get("days") ?? "28");
  const to = toParam ? new Date(toParam) : new Date();
  const from = fromParam ? new Date(fromParam) : new Date(to.getTime() - Math.max(1, days) * 86_400_000);
  return { from, to };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ brandId: string }> },
) {
  const { brandId } = await params;
  const organisationId = request.nextUrl.searchParams.get("organisationId");
  const section = request.nextUrl.searchParams.get("section") ?? "overview";
  const modelIds = request.nextUrl.searchParams.get("modelIds")?.split(",").filter(Boolean) ?? [];

  if (!organisationId) return apiSuccess({ error: "organisation_required" });
  if (!VALID_SECTIONS.includes(section as (typeof VALID_SECTIONS)[number])) {
    return apiSuccess({ error: "invalid_section" });
  }

  const { from, to } = parseDateRange(request.nextUrl.searchParams);

  return withApiHandler(
    request,
    async ({ tenant, requestId }) => {
      const orgId = tenant!.organisationId;
      const context = tenant!;

      switch (section) {
        case "journeys":
          return apiSuccess(
            { journeys: await attributionDashboardService.getJourneys(brandId, orgId, from, to, context) },
            { requestId },
          );
        case "conversions":
          return apiSuccess(
            { conversions: await attributionDashboardService.getConversions(brandId, orgId, from, to, context) },
            { requestId },
          );
        case "compare":
          return apiSuccess(
            {
              comparison: await attributionDashboardService.compareModels(
                brandId,
                orgId,
                from,
                to,
                modelIds,
                context,
              ),
            },
            { requestId },
          );
        case "models":
          return apiSuccess(
            { models: await attributionDashboardService.getModels(brandId, orgId, context) },
            { requestId },
          );
        case "warnings":
          return apiSuccess(
            { warnings: await attributionDashboardService.getWarnings(brandId, orgId, from, to, context) },
            { requestId },
          );
        default:
          return apiSuccess(
            { overview: await attributionDashboardService.getOverview(brandId, orgId, from, to, context) },
            { requestId },
          );
      }
    },
    { organisationId, permission: PERMISSIONS["marketingData.read"] },
  );
}
