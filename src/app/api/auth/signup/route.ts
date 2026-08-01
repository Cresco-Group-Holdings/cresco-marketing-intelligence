import { NextRequest } from "next/server";
import { AuthError } from "@supabase/supabase-js";
import {
  withPublicAuthHandler,
  apiSuccess,
  requireJsonContentType,
} from "@/lib/api/public-auth-handler";
import { parseBody, jsonBody } from "@/lib/api/handler";
import { GENERIC_SIGNUP_SUCCESS } from "@/lib/auth/constants";
import { getSupabaseConfigMetadata } from "@/lib/environment/supabase";
import { logger } from "@/lib/logging";
import { signupSchema } from "@/lib/validation/auth";
import { authService } from "@/server/services/auth-service";

function logSignupFailure(error: unknown, requestId: string): void {
  const metadata = getSupabaseConfigMetadata();

  logger.warn("auth.signup.failed", {
    requestId,
    supabaseHostSuffix: metadata.hostSuffix,
    supabaseUsesRuntimeServerVars: metadata.usesRuntimeServerVars,
    errorName: error instanceof Error ? error.name : "unknown",
    errorCode: error instanceof AuthError ? error.code : undefined,
    errorStatus: error instanceof AuthError ? error.status : undefined,
    errorMessage: error instanceof Error ? error.message : "unknown",
  });
}

export async function POST(request: NextRequest) {
  return withPublicAuthHandler(
    request,
    async ({ request, requestId }) => {
      requireJsonContentType(request);
      const body = parseBody(signupSchema, await jsonBody(request));

      try {
        await authService.signUp(body);
      } catch (error) {
        logSignupFailure(error, requestId);
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
