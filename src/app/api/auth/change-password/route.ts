import { NextRequest } from "next/server";
import { withApiHandler, parseBody, jsonBody } from "@/lib/api/handler";
import { apiSuccess } from "@/lib/api/response";
import { AppError } from "@/lib/errors";
import { GENERIC_LOGIN_ERROR } from "@/lib/auth/constants";
import { changePasswordSchema } from "@/lib/validation/auth";
import { authService } from "@/server/services/auth-service";
import { assertSameOrigin } from "@/lib/security/csrf";
import { enforceAuthRateLimit } from "@/lib/security/auth-rate-limit";
import { getClientIpAddress } from "@/lib/auth/request";

export async function POST(request: NextRequest) {
  return withApiHandler(request, async ({ user, requestId }) => {
    assertSameOrigin(request);
    const ipAddress = getClientIpAddress(request);
    enforceAuthRateLimit("change-password", ipAddress ?? user.userProfileId);

    const body = parseBody(changePasswordSchema, await jsonBody(request));

    const valid = await authService.verifyCurrentPassword(user.email, body.currentPassword);
    if (!valid) {
      throw new AppError("UNAUTHORIZED", GENERIC_LOGIN_ERROR);
    }

    const { error } = await authService.updatePassword(body.newPassword);
    if (error) {
      throw new AppError("VALIDATION_ERROR", "Unable to update password. Please try again.");
    }

    await authService.recordPasswordChanged(user.userProfileId, { requestId, ipAddress });

    return apiSuccess({ updated: true }, { requestId });
  });
}
