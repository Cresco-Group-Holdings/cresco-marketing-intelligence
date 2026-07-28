import { NextRequest } from "next/server";
import { apiSuccess, getOrganisationIdFromRequest, withApiHandler } from "@/lib/api/handler";
import { AppError } from "@/lib/errors";
import { PERMISSIONS } from "@/lib/tenancy/permissions";
import { membershipService } from "@/server/services";

type Params = { params: Promise<{ membershipId: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const { membershipId } = await params;
  const organisationId = getOrganisationIdFromRequest(request);
  if (!organisationId) {
    throw new AppError("TENANT_CONTEXT_REQUIRED", "Organisation context is required.");
  }

  return withApiHandler(
    request,
    async ({ requestId, tenant }) => {
      const membership = await membershipService.reactivate(
        membershipId,
        organisationId,
        tenant!,
        requestId,
      );
      return apiSuccess({ membership }, { requestId });
    },
    { organisationId, permission: PERMISSIONS["members.updateRole"] },
  );
}
