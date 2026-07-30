import { NextRequest } from "next/server";
import { apiSuccess, withApiHandler } from "@/lib/api/handler";
import { PERMISSIONS } from "@/lib/tenancy/permissions";
import { revenueDashboardService } from "@/server/services/revenue-dashboard-service";

const VALID_SECTIONS = ["overview", "customers", "subscriptions", "cohorts", "unit-economics", "warnings"] as const;

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
        case "customers":
          return apiSuccess(
            { customers: await revenueDashboardService.getCustomers(brandId, orgId, context) },
            { requestId },
          );
        case "subscriptions":
          return apiSuccess(
            { subscriptions: await revenueDashboardService.getSubscriptions(brandId, orgId, context) },
            { requestId },
          );
        case "cohorts":
          return apiSuccess(
            { cohorts: await revenueDashboardService.getCohorts(brandId, orgId, from, to, context) },
            { requestId },
          );
        case "unit-economics":
          return apiSuccess(
            { unitEconomics: await revenueDashboardService.getUnitEconomics(brandId, orgId, from, to, context) },
            { requestId },
          );
        case "warnings":
          return apiSuccess(
            { warnings: await revenueDashboardService.getWarnings(brandId, orgId, context) },
            { requestId },
          );
        default:
          return apiSuccess(
            { overview: await revenueDashboardService.getOverview(brandId, orgId, from, to, context) },
            { requestId },
          );
      }
    },
    { organisationId, permission: PERMISSIONS["marketingData.read"] },
  );
}
