import { NextRequest } from "next/server";
import { apiSuccess, withApiHandler } from "@/lib/api/handler";
import { PERMISSIONS } from "@/lib/tenancy/permissions";
import { marketingAnalystService } from "@/server/services/marketing-analyst-service";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ brandId: string; runId: string }> },
) {
  const { brandId, runId } = await params;
  const organisationId = request.nextUrl.searchParams.get("organisationId");
  if (!organisationId) return apiSuccess({ error: "organisation_required" });

  return withApiHandler(
    request,
    async ({ tenant, requestId }) => {
      const run = await marketingAnalystService.getRun(brandId, organisationId, runId, tenant!);
      if (!run) return apiSuccess({ error: "not_found" });
      return apiSuccess({ run }, { requestId });
    },
    { organisationId, permission: PERMISSIONS["ai.analyst.read"] },
  );
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ brandId: string; runId: string }> },
) {
  const { brandId, runId } = await params;
  const organisationId = request.nextUrl.searchParams.get("organisationId");
  if (!organisationId) return apiSuccess({ error: "organisation_required" });

  return withApiHandler(
    request,
    async ({ tenant, requestId }) => {
      const run = await marketingAnalystService.saveRun(brandId, organisationId, runId, tenant!);
      return apiSuccess({ run }, { requestId });
    },
    { organisationId, permission: PERMISSIONS["ai.analyst.read"] },
  );
}
