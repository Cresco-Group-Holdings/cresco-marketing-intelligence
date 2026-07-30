import { NextRequest } from "next/server";
import { apiSuccess, withApiHandler } from "@/lib/api/handler";
import { PERMISSIONS } from "@/lib/tenancy/permissions";
import { funnelDashboardService } from "@/server/services/funnel-dashboard-service";
import { funnelService } from "@/server/services/funnel-service";

const VALID_SECTIONS = ["overview", "detail", "cohorts", "segments", "warnings", "templates"] as const;

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
  const funnelId = request.nextUrl.searchParams.get("funnelId");

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
        case "detail":
          if (!funnelId) return apiSuccess({ error: "funnel_id_required" }, { requestId });
          return apiSuccess(
            { detail: await funnelDashboardService.getFunnelDetail(brandId, orgId, funnelId, from, to, context) },
            { requestId },
          );
        case "cohorts":
          if (!funnelId) return apiSuccess({ error: "funnel_id_required" }, { requestId });
          return apiSuccess(
            { cohorts: await funnelDashboardService.getCohorts(brandId, orgId, funnelId, context) },
            { requestId },
          );
        case "segments":
          if (!funnelId) return apiSuccess({ error: "funnel_id_required" }, { requestId });
          return apiSuccess(
            { segments: await funnelDashboardService.getSegments(brandId, orgId, funnelId, context) },
            { requestId },
          );
        case "templates":
          return apiSuccess(
            { templates: await funnelService.listAvailableTemplates(orgId) },
            { requestId },
          );
        case "warnings":
          return apiSuccess(
            { warnings: await funnelDashboardService.getWarnings(brandId, orgId, context) },
            { requestId },
          );
        default:
          return apiSuccess(
            { overview: await funnelDashboardService.getOverview(brandId, orgId, context) },
            { requestId },
          );
      }
    },
    { organisationId, permission: PERMISSIONS["marketingData.read"] },
  );
}
