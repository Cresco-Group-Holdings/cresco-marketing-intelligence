import { NextRequest } from "next/server";
import { z } from "zod";
import { apiSuccess, jsonBody, parseBody, withApiHandler } from "@/lib/api/handler";
import { activationService } from "@/server/services/activation-service";

const demoSchema = z.object({
  enabled: z.boolean(),
});

export async function POST(request: NextRequest) {
  return withApiHandler(request, async ({ request, requestId, user }) => {
    const body = parseBody(demoSchema, await jsonBody(request));
    await activationService.setDemoMode(user.userProfileId, body.enabled, requestId);
    const activation = await activationService.getState(user.userProfileId);
    return apiSuccess({ activation }, { requestId });
  });
}
