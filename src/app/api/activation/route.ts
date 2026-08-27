import { NextRequest } from "next/server";
import { apiSuccess, withApiHandler } from "@/lib/api/handler";
import { activationService } from "@/server/services/activation-service";

export async function GET(request: NextRequest) {
  return withApiHandler(request, async ({ requestId, user }) => {
    const activation = await activationService.getState(user.userProfileId);
    return apiSuccess({ activation }, { requestId });
  });
}
