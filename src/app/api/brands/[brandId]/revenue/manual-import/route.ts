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

  const body = (await request.json()) as {
    rows: Array<{
      providerCustomerId: string;
      amount: number;
      currency: string;
      occurredAt: string;
      transactionType?: string;
    }>;
  };

  return withApiHandler(
    request,
    async ({ tenant, requestId }) => {
      const result = await revenueSyncService.importManual(
        brandId,
        organisationId,
        body.rows ?? [],
        tenant!,
      );
      return apiSuccess({ result }, { requestId });
    },
    { organisationId, permission: PERMISSIONS["marketingData.manageSources"] },
  );
}
