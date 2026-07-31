import { NextRequest } from "next/server";
import { apiSuccess, withApiHandler } from "@/lib/api/handler";
import { PERMISSIONS } from "@/lib/tenancy/permissions";
import { revenueSyncService } from "@/server/services/revenue-sync-service";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ brandId: string }> },
) {
  const { brandId } = await params;
  const organisationId = request.nextUrl.searchParams.get("organisationId");
  if (!organisationId) return apiSuccess({ error: "organisation_required" });

  const body = (await request.json()) as { sourceType?: "STRIPE" | "CRM" | "MANUAL_IMPORT" | "INTERNAL_EVENT" };

  return withApiHandler(
    request,
    async ({ tenant, requestId }) => {
      const run = await revenueSyncService.sync(
        brandId,
        organisationId,
        body.sourceType ?? "STRIPE",
        tenant!,
      );
      return apiSuccess({ run }, { requestId });
    },
    { organisationId, permission: PERMISSIONS["marketingData.runSync"] },
  );
}
