import { NextRequest } from "next/server";
import {
  withPublicAuthHandler,
  apiSuccess,
  requireJsonContentType,
} from "@/lib/api/public-auth-handler";
import { parseBody, jsonBody } from "@/lib/api/handler";
import { forgotPasswordSchema } from "@/lib/validation/auth";
import { authService } from "@/server/services/auth-service";

export async function POST(request: NextRequest) {
  return withPublicAuthHandler(
    request,
    async ({ request, requestId }) => {
      requireJsonContentType(request);
      const body = parseBody(forgotPasswordSchema, await jsonBody(request));

      try {
        await authService.resendVerificationEmail(body.email);
      } catch {
        // Prevent account enumeration.
      }

      return apiSuccess(
        {
          message:
            "If an account exists and is unverified, a new verification email has been sent.",
        },
        { requestId },
      );
    },
    { rateLimitAction: "verify-email" },
  );
}
