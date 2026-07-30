import type { ConnectorType } from "@prisma/client";
import { NextRequest } from "next/server";
import { apiSuccess, withApiHandler } from "@/lib/api/handler";
import { PERMISSIONS } from "@/lib/tenancy/permissions";
import { isPaidAdsConnector } from "@/lib/paid-ads/constants";
import { paidAdsConnectionService } from "@/server/services/paid-ads-connection-service";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ brandId: string; connectorType: string }> },
) {
  const { brandId, connectorType: rawType } = await params;
  if (!isPaidAdsConnector(rawType as ConnectorType)) return apiSuccess({ items: [] });
  const connectorType = rawType as ConnectorType;
  const organisationId = request.nextUrl.searchParams.get("organisationId");
  if (!organisationId) return apiSuccess({ items: [] });

  return withApiHandler(
    request,
    async ({ tenant, requestId }) =>
      apiSuccess(
        {
          items: await paidAdsConnectionService.listAdAccounts(
            brandId,
            tenant!.organisationId,
            connectorType,
            tenant!,
          ),
        },
        { requestId },
      ),
    { organisationId, permission: PERMISSIONS["connectors.read"] },
  );
}
