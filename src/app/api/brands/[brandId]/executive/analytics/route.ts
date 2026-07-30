import { NextRequest } from "next/server";
import { apiSuccess, withApiHandler } from "@/lib/api/handler";
import { PERMISSIONS } from "@/lib/tenancy/permissions";
import type { ExecutiveComparisonType } from "@prisma/client";
import type { ExecutiveSection } from "@/lib/executive/types";
import { executiveDashboardService } from "@/server/services/executive-dashboard-service";

const VALID_SECTIONS = [
  "overview",
  "acquisition",
  "social",
  "search",
  "advertising",
  "funnel",
  "attribution",
  "leads",
  "revenue",
  "data-health",
  "objectives",
  "warnings",
] as const satisfies readonly ExecutiveSection[];

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
  const comparisonType = (request.nextUrl.searchParams.get("comparisonType") ??
    "PREVIOUS_PERIOD") as ExecutiveComparisonType;
  const reportingCurrency = request.nextUrl.searchParams.get("reportingCurrency") ?? undefined;

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
        case "objectives":
          return apiSuccess(
            { objectives: await executiveDashboardService.getObjectives(brandId, orgId, from, to, context) },
            { requestId },
          );
        case "warnings":
          return apiSuccess(
            { warnings: await executiveDashboardService.getWarnings(brandId, orgId, from, to, context) },
            { requestId },
          );
        case "data-health":
          return apiSuccess(
            { dataHealth: await executiveDashboardService.getDataHealth(brandId, orgId, context) },
            { requestId },
          );
        default:
          if (section === "overview") {
            return apiSuccess(
              {
                overview: await executiveDashboardService.getOverview(
                  brandId,
                  orgId,
                  from,
                  to,
                  comparisonType,
                  context,
                  { reportingCurrency },
                ),
              },
              { requestId },
            );
          }
          return apiSuccess(
            {
              section: await executiveDashboardService.getSection(
                section as ExecutiveSection,
                brandId,
                orgId,
                from,
                to,
                context,
              ),
            },
            { requestId },
          );
      }
    },
    { organisationId, permission: PERMISSIONS["marketingData.read"] },
  );
}
