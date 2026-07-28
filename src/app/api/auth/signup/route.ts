import { NextRequest } from "next/server";
import {
  withPublicAuthHandler,
  apiSuccess,
  requireJsonContentType,
} from "@/lib/api/public-auth-handler";
import { parseBody, jsonBody } from "@/lib/api/handler";
import { GENERIC_SIGNUP_SUCCESS } from "@/lib/auth/constants";
import { signupSchema } from "@/lib/validation/auth";
import { authService } from "@/server/services/auth-service";

export async function POST(request: NextRequest) {
  return withPublicAuthHandler(
    request,
    async ({ request, requestId }) => {
      requireJsonContentType(request);
      const body = parseBody(signupSchema, await jsonBody(request));

      try {
        await authService.signUp(body);
      } catch {
        // Prevent account enumeration — always return the same success response.
      }

      return apiSuccess(
        {
          message: GENERIC_SIGNUP_SUCCESS,
        },
        { requestId },
      );
    },
    { rateLimitAction: "signup" },
  );
}
