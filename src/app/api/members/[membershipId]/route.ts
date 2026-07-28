import { NextRequest } from "next/server";
import {
  apiSuccess,
  getOrganisationIdFromRequest,
  jsonBody,
  parseBody,
  withApiHandler,
} from "@/lib/api/handler";
import { AppError } from "@/lib/errors";
import { PERMISSIONS } from "@/lib/tenancy/permissions";
import { membershipRoleChangeSchema } from "@/lib/validation/workspace";
import { membershipService } from "@/server/services";

type Params = { params: Promise<{ membershipId: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const { membershipId } = await params;
  const organisationId = getOrganisationIdFromRequest(request);
  if (!organisationId) {
    throw new AppError("TENANT_CONTEXT_REQUIRED", "Organisation context is required.");
  }

  return withApiHandler(
    request,
    async ({ request, requestId, tenant }) => {
      const body = parseBody(membershipRoleChangeSchema, await jsonBody(request));
      const membership = await membershipService.changeRole(
        membershipId,
        organisationId,
        body.role,
        tenant!,
        requestId,
      );
      return apiSuccess({ membership }, { requestId });
    },
    { organisationId, permission: PERMISSIONS["members.updateRole"] },
  );
}
