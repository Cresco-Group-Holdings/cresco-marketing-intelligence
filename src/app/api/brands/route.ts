import { NextRequest } from "next/server";
import {
  apiSuccess,
  getOrganisationIdFromRequest,
  getProjectIdFromRequest,
  jsonBody,
  parseBody,
  withApiHandler,
} from "@/lib/api/handler";
import { AppError } from "@/lib/errors";
import { PERMISSIONS } from "@/lib/tenancy/permissions";
import { brandCreateSchema } from "@/lib/validation/workspace";
import { brandService } from "@/server/services";

export async function GET(request: NextRequest) {
  const organisationId = getOrganisationIdFromRequest(request);
  const projectId = getProjectIdFromRequest(request);
  if (!organisationId || !projectId) {
    throw new AppError("TENANT_CONTEXT_REQUIRED", "Organisation and project context are required.");
  }

  return withApiHandler(
    request,
    async ({ requestId, tenant }) => {
      const brands = await brandService.listForProject(organisationId, projectId, tenant!);
      return apiSuccess({ brands }, { requestId });
    },
    { organisationId, projectId, permission: PERMISSIONS["brands.read"] },
  );
}

export async function POST(request: NextRequest) {
  const organisationId = getOrganisationIdFromRequest(request);
  const projectId = getProjectIdFromRequest(request);
  if (!organisationId || !projectId) {
    throw new AppError("TENANT_CONTEXT_REQUIRED", "Organisation and project context are required.");
  }

  return withApiHandler(
    request,
    async ({ request, requestId, tenant }) => {
      const body = parseBody(brandCreateSchema, await jsonBody(request));
      const brand = await brandService.create(organisationId, projectId, body, tenant!, requestId);
      return apiSuccess({ brand }, { requestId });
    },
    { organisationId, projectId, permission: PERMISSIONS["brands.create"] },
  );
}
