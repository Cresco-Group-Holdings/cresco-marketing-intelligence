import { NextRequest } from "next/server";
import { apiSuccess, withApiHandler } from "@/lib/api/handler";
import { PERMISSIONS } from "@/lib/tenancy/permissions";
import { gscConnectionService } from "@/server/services/gsc-connection-service";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ brandId: string }> },
) {
  const { brandId } = await params;
  const organisationId = request.nextUrl.searchParams.get("organisationId");
  if (!organisationId) {
    return apiSuccess({ items: [] });
  }

  return withApiHandler(
    request,
    async ({ tenant, requestId }) =>
      apiSuccess(
        {
          items: await gscConnectionService.listSites(brandId, tenant!.organisationId, tenant!),
        },
        { requestId },
      ),
    { organisationId, permission: PERMISSIONS["connectors.read"] },
  );
}
