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
import { brandProfileUpdateSchema } from "@/lib/validation/workspace";
import { brandProfileService } from "@/server/services";

type Params = { params: Promise<{ brandId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { brandId } = await params;
  const organisationId = getOrganisationIdFromRequest(request);
  if (!organisationId) {
    throw new AppError("TENANT_CONTEXT_REQUIRED", "Organisation context is required.");
  }

  return withApiHandler(
    request,
    async ({ requestId }) => {
      const profile = await brandProfileService.get(brandId, organisationId);
      return apiSuccess({ profile }, { requestId });
    },
    { organisationId, permission: PERMISSIONS["brandProfile.read"] },
  );
}

export async function PUT(request: NextRequest, { params }: Params) {
  const { brandId } = await params;
  const organisationId = getOrganisationIdFromRequest(request);
  if (!organisationId) {
    throw new AppError("TENANT_CONTEXT_REQUIRED", "Organisation context is required.");
  }

  return withApiHandler(
    request,
    async ({ request, requestId, tenant }) => {
      const body = parseBody(brandProfileUpdateSchema, await jsonBody(request));
      const profile = await brandProfileService.upsert(
        brandId,
        organisationId,
        body,
        tenant!,
        requestId,
      );
      return apiSuccess({ profile }, { requestId });
    },
    { organisationId, permission: PERMISSIONS["brandProfile.update"] },
  );
}
