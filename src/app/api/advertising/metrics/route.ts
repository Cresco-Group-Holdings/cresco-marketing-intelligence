import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/response";
import { withApiHandler } from "@/lib/api/handler";
import { PERMISSIONS } from "@/lib/tenancy/permissions";
import { getAdvertisingMetricsSnapshot } from "@/lib/advertising/observability";

export async function GET(request: NextRequest) {
  const organisationId =
    request.nextUrl.searchParams.get("organisationId") ??
    request.headers.get("x-organisation-id") ??
    "";

  return withApiHandler(
    request,
    async ({ requestId }) =>
      apiSuccess({ metrics: getAdvertisingMetricsSnapshot() }, { requestId }),
    { organisationId: organisationId || undefined, permission: PERMISSIONS["advertisingPlans.read"] },
  );
}
