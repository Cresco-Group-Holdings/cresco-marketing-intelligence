import { NextRequest } from "next/server";
import {
  apiSuccess,
  jsonBody,
  parseBody,
  withApiHandler,
} from "@/lib/api/handler";
import { workspaceUpdateSchema } from "@/lib/validation/workspace";
import { workspaceService } from "@/server/services";

export async function GET(request: NextRequest) {
  return withApiHandler(request, async ({ requestId, user }) => {
    const workspace = await workspaceService.getResolvedWorkspace(user.userProfileId);
    return apiSuccess(workspace, { requestId });
  });
}

export async function PUT(request: NextRequest) {
  return withApiHandler(request, async ({ request, requestId, user }) => {
    const body = parseBody(workspaceUpdateSchema, await jsonBody(request));
    const preference = await workspaceService.updateWorkspace(
      user.userProfileId,
      body,
      requestId,
    );
    const workspace = await workspaceService.getResolvedWorkspace(user.userProfileId);
    return apiSuccess({ ...workspace, preference }, { requestId });
  });
}
