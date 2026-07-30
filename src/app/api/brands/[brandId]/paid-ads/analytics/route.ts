import type { ConnectorType } from "@prisma/client";
import { NextRequest } from "next/server";
import { apiSuccess, withApiHandler } from "@/lib/api/handler";
import { PERMISSIONS } from "@/lib/tenancy/permissions";
import { paidAdsDashboardService } from "@/server/services/paid-ads-dashboard-service";

const VALID_SECTIONS = ["overview", "campaigns", "ads", "creatives", "conversions", "warnings"] as const;

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
  const connectorType = request.nextUrl.searchParams.get("connectorType") as ConnectorType | null;

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
        case "campaigns":
          return apiSuccess(
            { campaigns: await paidAdsDashboardService.getCampaigns(brandId, orgId, from, to, context) },
            { requestId },
          );
        case "ads":
          return apiSuccess(
            { ads: await paidAdsDashboardService.getAds(brandId, orgId, from, to, context) },
            { requestId },
          );
        case "creatives":
          return apiSuccess(
            { creatives: await paidAdsDashboardService.getCreatives(brandId, orgId, context) },
            { requestId },
          );
        case "conversions":
          return apiSuccess(
            { conversions: await paidAdsDashboardService.getConversions(brandId, orgId, from, to, context) },
            { requestId },
          );
        case "warnings":
          if (!connectorType) return apiSuccess({ warnings: [], error: "connector_type_required" }, { requestId });
          return apiSuccess(
            {
              warnings: await paidAdsDashboardService.getQualityWarnings(
                brandId,
                orgId,
                connectorType,
                from,
                to,
                context,
              ),
            },
            { requestId },
          );
        default:
          return apiSuccess(
            { overview: await paidAdsDashboardService.getOverview(brandId, orgId, from, to, context) },
            { requestId },
          );
      }
    },
    { organisationId, permission: PERMISSIONS["connectors.read"] },
  );
}
