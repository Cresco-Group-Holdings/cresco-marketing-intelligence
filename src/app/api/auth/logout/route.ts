import { NextRequest } from "next/server";
import { withApiHandler, jsonBody } from "@/lib/api/handler";
import { apiSuccess } from "@/lib/api/response";
import { assertSameOrigin } from "@/lib/security/csrf";
import { authService } from "@/server/services/auth-service";
import { getClientIpAddress } from "@/lib/auth/request";

export async function POST(request: NextRequest) {
  return withApiHandler(request, async ({ user, requestId }) => {
    assertSameOrigin(request);
    const ipAddress = getClientIpAddress(request);
    const body = await jsonBody<{ scope?: "local" | "global" | "others" }>(request);
    const scope = body.scope ?? "local";

    await authService.signOut(scope);
    await authService.recordLogout(user.userProfileId, { requestId, ipAddress });

    if (scope === "global" || scope === "others") {
      await authService.recordSessionRevoked(user.userProfileId, { requestId, ipAddress }, scope);
    }

    return apiSuccess({ signedOut: true }, { requestId });
  });
}
