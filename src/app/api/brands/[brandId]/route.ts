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
import { brandUpdateSchema } from "@/lib/validation/workspace";
import { brandService } from "@/server/services";

type Params = { params: Promise<{ brandId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { brandId } = await params;
  const organisationId = getOrganisationIdFromRequest(request);
  if (!organisationId) {
    throw new AppError("TENANT_CONTEXT_REQUIRED", "Organisation context is required.");
  }

  return withApiHandler(
    request,
    async ({ requestId, tenant }) => {
      const brand = await brandService.getById(brandId, organisationId, tenant!);
      return apiSuccess({ brand }, { requestId });
    },
    { organisationId, permission: PERMISSIONS["brands.read"] },
  );
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const { brandId } = await params;
  const organisationId = getOrganisationIdFromRequest(request);
  if (!organisationId) {
    throw new AppError("TENANT_CONTEXT_REQUIRED", "Organisation context is required.");
  }

  return withApiHandler(
    request,
    async ({ request, requestId, tenant }) => {
      const body = parseBody(brandUpdateSchema, await jsonBody(request));
      const brand = await brandService.update(
        brandId,
        organisationId,
        {
          name: body.name,
          slug: body.slug,
          description: body.description || null,
          website: body.website || null,
          primaryDomain: body.primaryDomain || null,
          logoUrl: body.logoUrl || null,
          faviconUrl: body.faviconUrl || null,
          primaryColour: body.primaryColour || null,
          secondaryColour: body.secondaryColour || null,
          accentColour: body.accentColour || null,
          status: body.status,
        },
        tenant!,
        requestId,
      );
      return apiSuccess({ brand }, { requestId });
    },
    { organisationId, permission: PERMISSIONS["brands.update"] },
  );
}
