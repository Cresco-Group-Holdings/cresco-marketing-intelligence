import { NextRequest } from "next/server";
import { apiSuccess, getOrganisationIdFromRequest, withApiHandler } from "@/lib/api/handler";
import { AppError } from "@/lib/errors";
import { PERMISSIONS } from "@/lib/tenancy/permissions";
import { auditService } from "@/server/services";

export async function GET(request: NextRequest) {
  const organisationId = getOrganisationIdFromRequest(request);
  if (!organisationId) {
    throw new AppError("TENANT_CONTEXT_REQUIRED", "Organisation context is required.");
  }

  return withApiHandler(
    request,
    async ({ requestId }) => {
      const events = await auditService.list(organisationId);
      return apiSuccess({ events }, { requestId });
    },
    { organisationId, permission: PERMISSIONS["auditLogs.read"] },
  );
}
