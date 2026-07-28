import { NextRequest } from "next/server";
import {
  apiSuccess,
  getOrganisationIdFromRequest,
  withApiHandler,
} from "@/lib/api/handler";
import { AppError } from "@/lib/errors";
import { PERMISSIONS } from "@/lib/tenancy/permissions";
import { membershipService } from "@/server/services";

export async function GET(request: NextRequest) {
  const organisationId = getOrganisationIdFromRequest(request);
  if (!organisationId) {
    throw new AppError("TENANT_CONTEXT_REQUIRED", "Organisation context is required.");
  }

  return withApiHandler(
    request,
    async ({ requestId }) => {
      const members = await membershipService.list(organisationId);
      return apiSuccess({ members }, { requestId });
    },
    { organisationId, permission: PERMISSIONS["members.read"] },
  );
}
