import { NextRequest } from "next/server";
import { apiSuccess, getOrganisationIdFromRequest, withApiHandler } from "@/lib/api/handler";
import { AppError } from "@/lib/errors";
import { PERMISSIONS } from "@/lib/tenancy/permissions";
import { invitationService } from "@/server/services";

type Params = { params: Promise<{ invitationId: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const { invitationId } = await params;
  const organisationId = getOrganisationIdFromRequest(request);
  if (!organisationId) {
    throw new AppError("TENANT_CONTEXT_REQUIRED", "Organisation context is required.");
  }

  return withApiHandler(
    request,
    async ({ requestId, tenant }) => {
      const invitation = await invitationService.revoke(
        invitationId,
        organisationId,
        tenant!,
        requestId,
      );
      return apiSuccess({ invitation }, { requestId });
    },
    { organisationId, permission: PERMISSIONS["members.invite"] },
  );
}
