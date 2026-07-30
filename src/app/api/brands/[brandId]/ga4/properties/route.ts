import { NextRequest } from "next/server";
import { apiSuccess, withApiHandler } from "@/lib/api/handler";
import { PERMISSIONS } from "@/lib/tenancy/permissions";
import { ga4ConnectionService } from "@/server/services/ga4-connection-service";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ brandId: string }> },
) {
  const { brandId } = await params;
  const organisationId = request.nextUrl.searchParams.get("organisationId");
  const accountName = request.nextUrl.searchParams.get("accountName");
  if (!organisationId || !accountName) {
    return apiSuccess({ items: [] });
  }

  return withApiHandler(
    request,
    async ({ tenant, requestId }) =>
      apiSuccess(
        {
          items: await ga4ConnectionService.listProperties(
            brandId,
            tenant!.organisationId,
            accountName,
            tenant!,
          ),
        },
        { requestId },
      ),
    { organisationId, permission: PERMISSIONS["connectors.read"] },
  );
}
