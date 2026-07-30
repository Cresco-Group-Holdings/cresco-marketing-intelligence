import { NextRequest } from "next/server";
import { apiSuccess, withApiHandler } from "@/lib/api/handler";
import { PERMISSIONS } from "@/lib/tenancy/permissions";
import { gscConnectionService } from "@/server/services/gsc-connection-service";
import { gscSyncService } from "@/server/services/gsc-sync-service";

function withGscRead(request: NextRequest, handler: Parameters<typeof withApiHandler>[1]) {
  const organisationId = request.nextUrl.searchParams.get("organisationId");
  if (!organisationId) {
    return apiSuccess({ error: "organisation_required" });
  }
  return withApiHandler(request, handler, {
    organisationId,
    permission: PERMISSIONS["connectors.read"],
  });
}

function withGscManage(request: NextRequest, handler: Parameters<typeof withApiHandler>[1]) {
  const organisationId = request.nextUrl.searchParams.get("organisationId");
  if (!organisationId) {
    return apiSuccess({ error: "organisation_required" });
  }
  return withApiHandler(request, handler, {
    organisationId,
    permission: PERMISSIONS["connectors.update"],
  });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ brandId: string }> },
) {
  const { brandId } = await params;
  return withGscRead(request, async ({ tenant, requestId }) =>
    apiSuccess(
      {
        connection: await gscConnectionService.getConnectionStatus(
          brandId,
          tenant!.organisationId,
          tenant!,
        ),
        sync: await gscSyncService.getSyncStatus(brandId, tenant!.organisationId, tenant!),
      },
      { requestId },
    ),
  );
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ brandId: string }> },
) {
  const { brandId } = await params;
  const body = (await request.json()) as { syncType?: "INITIAL" | "INCREMENTAL" };

  return withGscManage(request, async ({ tenant, requestId }) =>
    apiSuccess(
      {
        sync: await gscSyncService.startSync(
          brandId,
          tenant!.organisationId,
          body.syncType ?? "INCREMENTAL",
          tenant!,
          requestId,
        ),
      },
      { requestId },
    ),
  );
}
