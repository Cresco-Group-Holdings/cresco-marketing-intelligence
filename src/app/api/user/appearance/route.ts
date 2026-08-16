import { NextRequest } from "next/server";
import {
  apiSuccess,
  jsonBody,
  parseBody,
  withApiHandler,
} from "@/lib/api/handler";
import { appearanceUpdateSchema, normaliseAppearanceInput } from "@/lib/validation/appearance";
import { appearanceService } from "@/server/services/appearance-service";

export async function GET(request: NextRequest) {
  return withApiHandler(request, async ({ requestId, user }) => {
    const appearance = await appearanceService.getAppearance(user.userProfileId);
    return apiSuccess({ appearance }, { requestId });
  });
}

export async function PUT(request: NextRequest) {
  return withApiHandler(request, async ({ request, requestId, user }) => {
    const body = parseBody(appearanceUpdateSchema, await jsonBody(request));
    const appearance = normaliseAppearanceInput(body);
    const saved = await appearanceService.updateAppearance(user.userProfileId, appearance);
    return apiSuccess({ appearance: saved }, { requestId });
  });
}
