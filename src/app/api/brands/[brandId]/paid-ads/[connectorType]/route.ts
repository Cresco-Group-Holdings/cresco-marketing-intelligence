import type { ConnectorType } from "@prisma/client";
import { NextRequest } from "next/server";
import { apiSuccess, withApiHandler } from "@/lib/api/handler";
import { PERMISSIONS } from "@/lib/tenancy/permissions";
import { z } from "zod";
import { isPaidAdsConnector } from "@/lib/paid-ads/constants";
import { paidAdsConnectionService } from "@/server/services/paid-ads-connection-service";
import { paidAdsSyncService } from "@/server/services/paid-ads-sync-service";

const selectAccountSchema = z.object({
  accountId: z.string().min(1),
  accountLabel: z.string().optional(),
  currency: z.string().optional(),
  timezone: z.string().optional(),
});

function parseConnectorType(value: string): ConnectorType {
  if (!isPaidAdsConnector(value as ConnectorType)) {
    throw new Error("Invalid paid ads connector type.");
  }
  return value as ConnectorType;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ brandId: string; connectorType: string }> },
) {
  const { brandId, connectorType: rawType } = await params;
  const connectorType = parseConnectorType(rawType);
  const organisationId = request.nextUrl.searchParams.get("organisationId");
  if (!organisationId) return apiSuccess({ error: "organisation_required" });

  return withApiHandler(
    request,
    async ({ tenant, requestId }) =>
      apiSuccess(
        {
          connection: await paidAdsConnectionService.getConnectionStatus(
            brandId,
            tenant!.organisationId,
            connectorType,
            tenant!,
          ),
          sync: await paidAdsSyncService.getSyncStatus(brandId, tenant!.organisationId, connectorType, tenant!),
        },
        { requestId },
      ),
    { organisationId, permission: PERMISSIONS["connectors.read"] },
  );
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ brandId: string; connectorType: string }> },
) {
  const { brandId, connectorType: rawType } = await params;
  const connectorType = parseConnectorType(rawType);
  const organisationId = request.nextUrl.searchParams.get("organisationId");
  if (!organisationId) return apiSuccess({ error: "organisation_required" });

  const body = (await request.json()) as { syncType?: "INITIAL" | "INCREMENTAL" };

  return withApiHandler(
    request,
    async ({ tenant, requestId }) =>
      apiSuccess(
        {
          sync: await paidAdsSyncService.startSync(
            brandId,
            tenant!.organisationId,
            connectorType,
            body.syncType ?? "INCREMENTAL",
            tenant!,
            requestId,
          ),
        },
        { requestId },
      ),
    { organisationId, permission: PERMISSIONS["connectors.update"] },
  );
}
