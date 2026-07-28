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
import { projectUpdateSchema } from "@/lib/validation/workspace";
import { projectService } from "@/server/services";

type Params = { params: Promise<{ projectId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { projectId } = await params;
  const organisationId = getOrganisationIdFromRequest(request);
  if (!organisationId) {
    throw new AppError("TENANT_CONTEXT_REQUIRED", "Organisation context is required.");
  }

  return withApiHandler(
    request,
    async ({ requestId, tenant }) => {
      const project = await projectService.getById(projectId, organisationId, tenant!);
      return apiSuccess({ project }, { requestId });
    },
    { organisationId, projectId, permission: PERMISSIONS["projects.read"] },
  );
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const { projectId } = await params;
  const organisationId = getOrganisationIdFromRequest(request);
  if (!organisationId) {
    throw new AppError("TENANT_CONTEXT_REQUIRED", "Organisation context is required.");
  }

  return withApiHandler(
    request,
    async ({ request, requestId, tenant }) => {
      const body = parseBody(projectUpdateSchema, await jsonBody(request));
      const project = await projectService.update(
        projectId,
        organisationId,
        {
          name: body.name,
          slug: body.slug,
          description: body.description || null,
          website: body.website || null,
          status: body.status,
        },
        tenant!,
        requestId,
      );
      return apiSuccess({ project }, { requestId });
    },
    { organisationId, projectId, permission: PERMISSIONS["projects.update"] },
  );
}
