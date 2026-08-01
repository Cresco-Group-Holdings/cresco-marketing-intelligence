import { NextRequest } from "next/server";
import { AuthError } from "@supabase/supabase-js";
import {
  withPublicAuthHandler,
  apiSuccess,
  requireJsonContentType,
} from "@/lib/api/public-auth-handler";
import { parseBody, jsonBody } from "@/lib/api/handler";
import { AppError } from "@/lib/errors";
import {
  getGenericSignupSuccessMessage,
  mapSignupAuthError,
} from "@/lib/auth/signup-errors";
import { getSupabaseConfigMetadata } from "@/lib/environment/supabase";
import { logger } from "@/lib/logging";
import { signupSchema } from "@/lib/validation/auth";
import { authService } from "@/server/services/auth-service";

function logSignupFailure(error: unknown, requestId: string, stage: string): void {
  const metadata = getSupabaseConfigMetadata();

  logger.warn("auth.signup.failed", {
    requestId,
    stage,
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
        const outcome = await authService.signUp(body);

        return apiSuccess(
          {
            message: getGenericSignupSuccessMessage(),
            emailVerificationRequired: outcome.emailVerificationRequired,
            userCreated: outcome.userCreated,
            antiEnumeration: outcome.antiEnumeration,
          },
          { requestId },
        );
      } catch (error) {
        const appError =
          error instanceof AppError ? error : mapSignupAuthError(error, "supabase_signup");

        logSignupFailure(appError, requestId, appError.code);
        throw appError;
      }
    },
    { rateLimitAction: "signup" },
  );
}
