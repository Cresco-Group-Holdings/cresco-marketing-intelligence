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
import { invitationCreateSchema } from "@/lib/validation/workspace";
import { invitationService } from "@/server/services";

export async function GET(request: NextRequest) {
  const organisationId = getOrganisationIdFromRequest(request);
  if (!organisationId) {
    throw new AppError("TENANT_CONTEXT_REQUIRED", "Organisation context is required.");
  }

  return withApiHandler(
    request,
    async ({ requestId }) => {
      const invitations = await invitationService.list(organisationId);
      return apiSuccess({ invitations }, { requestId });
    },
    { organisationId, permission: PERMISSIONS["members.read"] },
  );
}

export async function POST(request: NextRequest) {
  const organisationId = getOrganisationIdFromRequest(request);
  if (!organisationId) {
    throw new AppError("TENANT_CONTEXT_REQUIRED", "Organisation context is required.");
  }

  return withApiHandler(
    request,
    async ({ request, requestId, tenant }) => {
      const body = parseBody(invitationCreateSchema, await jsonBody(request));
      const result = await invitationService.create(organisationId, body, tenant!, requestId);

      const response: Record<string, unknown> = { invitation: result.invitation };
      if (process.env.NODE_ENV !== "production") {
        response.developmentInviteUrl = `/accept-invite?token=${result.token}`;
      }

      return apiSuccess(response, { requestId });
    },
    { organisationId, permission: PERMISSIONS["members.invite"] },
  );
}
