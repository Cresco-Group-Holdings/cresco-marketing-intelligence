import type { ConnectorType } from "@prisma/client";
import { NextRequest } from "next/server";
import { apiSuccess, parseBody, withApiHandler } from "@/lib/api/handler";
import { PERMISSIONS } from "@/lib/tenancy/permissions";
import { z } from "zod";
import { isPaidAdsConnector } from "@/lib/paid-ads/constants";
import { paidAdsConnectionService } from "@/server/services/paid-ads-connection-service";

const selectAccountSchema = z.object({
  accountId: z.string().min(1),
  accountLabel: z.string().optional(),
  currency: z.string().optional(),
  timezone: z.string().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ brandId: string; connectorType: string }> },
) {
  const { brandId, connectorType: rawType } = await params;
  if (!isPaidAdsConnector(rawType as ConnectorType)) return apiSuccess({ error: "invalid_connector" });
  const connectorType = rawType as ConnectorType;
  const organisationId = request.nextUrl.searchParams.get("organisationId");
  if (!organisationId) return apiSuccess({ error: "organisation_required" });

  const input = parseBody(selectAccountSchema, await request.json());

  return withApiHandler(
    request,
    async ({ tenant, requestId }) =>
      apiSuccess(
        {
          result: await paidAdsConnectionService.selectAdAccount(
            brandId,
            tenant!.organisationId,
            connectorType,
            input,
            tenant!,
          ),
        },
        { requestId },
      ),
    { organisationId, permission: PERMISSIONS["connectors.update"] },
  );
}
