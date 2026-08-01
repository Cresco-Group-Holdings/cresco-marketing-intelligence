import { NextRequest } from "next/server";
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
import {
  logSignupCatch,
  logSignupRuntimeEnv,
  logSignupTrace,
} from "@/lib/auth/signup-trace";
import { signupSchema } from "@/lib/validation/auth";
import { authService } from "@/server/services/auth-service";

export async function POST(request: NextRequest) {
  return withPublicAuthHandler(
    request,
    async ({ request, requestId }) => {
      logSignupTrace("ENTER signup route", requestId);
      logSignupRuntimeEnv(requestId);

      try {
        requireJsonContentType(request);
        const body = parseBody(signupSchema, await jsonBody(request));

        logSignupTrace("ENTER authService.signUp", requestId);
        const outcome = await authService.signUp(body, { requestId });
        logSignupTrace("EXIT authService.signUp", requestId, {
          stage: outcome.stage,
          userCreated: outcome.userCreated,
          antiEnumeration: outcome.antiEnumeration,
        });

        logSignupTrace("EXIT signup route", requestId, { status: 200 });
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
        logSignupCatch("signup route", requestId, error);
        const appError =
          error instanceof AppError ? error : mapSignupAuthError(error, "supabase_signup", requestId);
        logSignupTrace("EXIT signup route", requestId, {
          status: appError.status,
          code: appError.code,
        });
        throw appError;
      }
    },
    { rateLimitAction: "signup" },
  );
}
