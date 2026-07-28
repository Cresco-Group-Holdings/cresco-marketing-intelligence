import { NextRequest } from "next/server";
import {
  withPublicAuthHandler,
  apiSuccess,
  requireJsonContentType,
} from "@/lib/api/public-auth-handler";
import { parseBody, jsonBody } from "@/lib/api/handler";
import { GENERIC_PASSWORD_RESET_SUCCESS } from "@/lib/auth/constants";
import { forgotPasswordSchema } from "@/lib/validation/auth";
import { authService } from "@/server/services/auth-service";

export async function POST(request: NextRequest) {
  return withPublicAuthHandler(
    request,
    async ({ request, requestId, ipAddress }) => {
      requireJsonContentType(request);
      const body = parseBody(forgotPasswordSchema, await jsonBody(request));

      try {
        await authService.requestPasswordReset(body.email);
      } catch {
        // Prevent account enumeration.
      }

      await authService.recordPasswordResetRequested({ requestId, ipAddress });

      return apiSuccess(
        {
          message: GENERIC_PASSWORD_RESET_SUCCESS,
        },
        { requestId },
      );
    },
    { rateLimitAction: "forgot-password" },
  );
}
