import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/handler";
import { withApiHandler } from "@/lib/api/handler";
import { PERMISSIONS } from "@/lib/tenancy/permissions";
import { ga4ConnectionService } from "@/server/services/ga4-connection-service";
import { ga4SyncService } from "@/server/services/ga4-sync-service";

function withGa4Read(request: NextRequest, handler: Parameters<typeof withApiHandler>[1]) {
  const organisationId = request.nextUrl.searchParams.get("organisationId");
  if (!organisationId) {
    return apiSuccess({ error: "organisation_required" });
  }
  return withApiHandler(request, handler, {
    organisationId,
    permission: PERMISSIONS["connectors.read"],
  });
}

function withGa4Manage(request: NextRequest, handler: Parameters<typeof withApiHandler>[1]) {
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
  return withGa4Read(request, async ({ tenant, requestId }) =>
    apiSuccess(
      {
        connection: await ga4ConnectionService.getConnectionStatus(
          brandId,
          tenant!.organisationId,
          tenant!,
        ),
        sync: await ga4SyncService.getSyncStatus(brandId, tenant!.organisationId, tenant!),
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

  return withGa4Manage(request, async ({ tenant, requestId }) =>
    apiSuccess(
      {
        sync: await ga4SyncService.startSync(
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
