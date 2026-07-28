import { NextRequest } from "next/server";
import {
  apiSuccess,
  getOrganisationIdFromRequest,
  jsonBody,
  parseBody,
  withApiHandler,
} from "@/lib/api/handler";
import { PERMISSIONS } from "@/lib/tenancy/permissions";
import { projectCreateSchema } from "@/lib/validation/workspace";
import { projectService } from "@/server/services";

export async function GET(request: NextRequest) {
  const organisationId = getOrganisationIdFromRequest(request);
  if (!organisationId) {
    return withApiHandler(request, async () => {
      throw new Error("organisationId required");
    });
  }

  return withApiHandler(
    request,
    async ({ requestId, tenant }) => {
      const projects = await projectService.listActive(organisationId, tenant!);
      return apiSuccess({ projects }, { requestId });
    },
    { organisationId, permission: PERMISSIONS["projects.read"] },
  );
}

export async function POST(request: NextRequest) {
  const organisationId = getOrganisationIdFromRequest(request);
  if (!organisationId) {
    return withApiHandler(request, async () => {
      throw new Error("organisationId required");
    });
  }

  return withApiHandler(
    request,
    async ({ request, requestId, tenant }) => {
      const body = parseBody(projectCreateSchema, await jsonBody(request));
      const project = await projectService.create(organisationId, body, tenant!, requestId);
      return apiSuccess({ project }, { requestId });
    },
    { organisationId, permission: PERMISSIONS["projects.create"] },
  );
}
