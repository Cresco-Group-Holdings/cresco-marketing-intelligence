import { NextRequest } from "next/server";
import { apiSuccess, withApiHandler } from "@/lib/api/handler";
import { PERMISSIONS } from "@/lib/tenancy/permissions";
import { ga4ReconciliationService } from "@/server/services/ga4-reconciliation-service";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ brandId: string }> },
) {
  const { brandId } = await params;
  const organisationId = request.nextUrl.searchParams.get("organisationId");
  const fromParam = request.nextUrl.searchParams.get("from");
  const toParam = request.nextUrl.searchParams.get("to");

  if (!organisationId) {
    return apiSuccess({ error: "organisation_required" });
  }

  const to = toParam ? new Date(toParam) : new Date();
  const from = fromParam
    ? new Date(fromParam)
    : new Date(to.getTime() - 30 * 86_400_000);

  return withApiHandler(
    request,
    async ({ tenant, requestId }) =>
      apiSuccess(
        {
          reconciliation: await ga4ReconciliationService.compareSources(
            brandId,
            tenant!.organisationId,
            from,
            to,
            tenant!,
          ),
        },
        { requestId },
      ),
    { organisationId, permission: PERMISSIONS["connectors.read"] },
  );
}
