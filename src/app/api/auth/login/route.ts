import { NextRequest } from "next/server";
import {
  withPublicAuthHandler,
  apiSuccess,
  requireJsonContentType,
} from "@/lib/api/public-auth-handler";
import { parseBody, jsonBody } from "@/lib/api/handler";
import { AppError } from "@/lib/errors";
import { GENERIC_LOGIN_ERROR } from "@/lib/auth/constants";
import { loginSchema } from "@/lib/validation/auth";
import { authService } from "@/server/services/auth-service";
import {
  resolveAuthenticatedRedirect,
  resolvePostAuthRedirectPath,
} from "@/lib/auth/post-auth";
import { resolveSafeRedirectPath } from "@/lib/security/redirects";
import { enforceAuthRateLimit } from "@/lib/security/auth-rate-limit";

function mapLoginProvisioningError(error: unknown): AppError {
  const prismaCode =
    error && typeof error === "object" && "code" in error
      ? String((error as { code?: string }).code)
      : undefined;

  if (prismaCode?.startsWith("P10")) {
    return new AppError(
      "AUTH_PROVIDER_UNAVAILABLE",
      "Authentication services are temporarily unavailable.",
      { status: 503, expose: true, cause: error },
    );
  }

  return new AppError(
    "PROFILE_PROVISIONING_FAILED",
    "Your account exists, but profile setup is still pending. Please try again shortly.",
    { status: 503, expose: true, cause: error },
  );
}

export async function POST(request: NextRequest) {
  return withPublicAuthHandler(
    request,
    async ({ request, requestId, ipAddress }) => {
      requireJsonContentType(request);
      const body = parseBody(loginSchema, await jsonBody(request));
      enforceAuthRateLimit("login", ipAddress ?? body.email);

      const { data, error } = await authService.signInWithPassword(body.email, body.password);

      if (error || !data.user?.email) {
        await authService.recordLoginFailed(
          { requestId, ipAddress },
          { reason: "invalid_credentials" },
        );
        throw new AppError("UNAUTHORIZED", GENERIC_LOGIN_ERROR);
      }

      let provisioned;
      try {
        provisioned = await authService.provisionFromAuthUser(data.user, {
          requestId,
          ipAddress,
        });
      } catch (provisioningError) {
        throw mapLoginProvisioningError(provisioningError);
      }

      await authService.recordLoginSucceeded(provisioned.userProfileId, { requestId, ipAddress }, {
        provider: "email",
      });

      const redirectPath = resolveAuthenticatedRedirect(
        body.redirect,
        await resolvePostAuthRedirectPath(provisioned.userProfileId),
      );

      return apiSuccess(
        {
          redirectTo: resolveSafeRedirectPath(redirectPath, "/dashboard"),
          emailVerified: Boolean(data.user.email_confirmed_at),
        },
        { requestId },
      );
    },
  );
}
