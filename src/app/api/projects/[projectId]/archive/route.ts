import { NextRequest } from "next/server";
import { apiSuccess, getOrganisationIdFromRequest, withApiHandler } from "@/lib/api/handler";
import { AppError } from "@/lib/errors";
import { PERMISSIONS } from "@/lib/tenancy/permissions";
import { projectService } from "@/server/services";

type Params = { params: Promise<{ projectId: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const { projectId } = await params;
  const organisationId = getOrganisationIdFromRequest(request);
  if (!organisationId) {
    throw new AppError("TENANT_CONTEXT_REQUIRED", "Organisation context is required.");
  }

  return withApiHandler(
    request,
    async ({ requestId, tenant }) => {
      const project = await projectService.archive(projectId, organisationId, tenant!, requestId);
      return apiSuccess({ project }, { requestId });
    },
    { organisationId, projectId, permission: PERMISSIONS["projects.archive"] },
  );
}
