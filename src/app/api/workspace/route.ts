import { NextRequest } from "next/server";
import {
  apiSuccess,
  jsonBody,
  parseBody,
  withApiHandler,
} from "@/lib/api/handler";
import { resolveOnboardingStatus, serializeOnboardingStatus } from "@/lib/onboarding/status";
import { workspaceUpdateSchema } from "@/lib/validation/workspace";
import { workspaceService } from "@/server/services/workspace-service";

async function withOnboardingStatus(userProfileId: string) {
  const [workspace, onboarding] = await Promise.all([
    workspaceService.getResolvedWorkspace(userProfileId),
    resolveOnboardingStatus(userProfileId),
  ]);

  const serializedOnboarding = serializeOnboardingStatus(onboarding);

  return {
    ...workspace,
    onboarding: serializedOnboarding,
    preference: {
      ...workspace.preference,
      onboardingCompletedAt:
        serializedOnboarding.completedAt ?? workspace.preference.onboardingCompletedAt,
    },
  };
}

export async function GET(request: NextRequest) {
  return withApiHandler(request, async ({ requestId, user }) => {
    const workspace = await withOnboardingStatus(user.userProfileId);
    return apiSuccess(workspace, { requestId });
  });
}

export async function PUT(request: NextRequest) {
  return withApiHandler(request, async ({ request, requestId, user }) => {
    const body = parseBody(workspaceUpdateSchema, await jsonBody(request));
    await workspaceService.updateWorkspace(user.userProfileId, body, requestId);
    const workspace = await withOnboardingStatus(user.userProfileId);
    return apiSuccess(workspace, { requestId });
  });
}
