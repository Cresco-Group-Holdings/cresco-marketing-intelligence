import { NextResponse } from "next/server";
import { createRequestId } from "@/lib/api/response";
import { AUTH_ERROR_PATH } from "@/lib/auth/constants";
import {
  completeAuthCallbackSession,
  parseAuthCallbackParams,
  type AuthCallbackErrorCode,
} from "@/lib/auth/callback-exchange";
import { authService } from "@/server/services/auth-service";
import { createSupabaseServerClient } from "@/lib/auth/supabase-server";
import { getClientIpAddress } from "@/lib/auth/request";
import { resolveSafeRedirectPath } from "@/lib/security/redirects";
import { resolveAuthenticatedRedirect } from "@/lib/auth/post-auth";
import { logger } from "@/lib/logging";

function redirectToAuthError(origin: string, code: AuthCallbackErrorCode | "missing_user" | "provisioning_failed") {
  const errorUrl = new URL(AUTH_ERROR_PATH, origin);
  errorUrl.searchParams.set("code", code);
  return NextResponse.redirect(errorUrl);
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const requestId = createRequestId();
  const ipAddress = getClientIpAddress(request);
  const params = parseAuthCallbackParams(requestUrl);

  if (params.providerError) {
    logger.warn("auth.callback.oauth_error", {
      requestId,
      error: params.providerError,
      hasErrorDescription: Boolean(params.providerErrorDescription),
      queryParamNames: params.queryParamNames,
    });

    return redirectToAuthError(requestUrl.origin, "oauth_failed");
  }

  const supabase = await createSupabaseServerClient();
  const { error: sessionError } = await completeAuthCallbackSession(supabase, params);

  if (sessionError) {
    logger.warn("auth.callback.session_failed", {
      requestId,
      errorCode: sessionError,
      hasCode: Boolean(params.code),
      hasTokenHash: Boolean(params.tokenHash),
      confirmationType: params.type,
      queryParamNames: params.queryParamNames,
    });

    return redirectToAuthError(requestUrl.origin, sessionError);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return redirectToAuthError(requestUrl.origin, "missing_user");
  }

  let provisioned;
  try {
    provisioned = await authService.provisionFromAuthUser(user, { requestId, ipAddress });
  } catch (error) {
    logger.warn("auth.callback.provisioning_failed", {
      requestId,
      queryParamNames: params.queryParamNames,
      confirmationType: params.type,
      cause:
        error instanceof Error
          ? { name: error.name, message: error.message }
          : "unknown",
    });

    return redirectToAuthError(requestUrl.origin, "provisioning_failed");
  }

  const provider = user.app_metadata?.provider;
  if (provider && provider !== "email") {
    await authService.recordOAuthConnected(provisioned.userProfileId, String(provider), {
      requestId,
      ipAddress,
    });
  }

  const isEmailConfirmation =
    Boolean(params.tokenHash) ||
    params.type === "signup" ||
    params.type === "email" ||
    params.type === "magiclink";

  if (isEmailConfirmation || user.email_confirmed_at) {
    await authService.recordEmailVerified(provisioned.userProfileId, { requestId, ipAddress });
  }

  await authService.recordLoginSucceeded(
    provisioned.userProfileId,
    { requestId, ipAddress },
    { provider: provider ?? "email" },
  );

  const redirectPath = resolveAuthenticatedRedirect(
    params.requestedRedirect,
    provisioned.redirectPath,
  );

  return NextResponse.redirect(
    new URL(resolveSafeRedirectPath(redirectPath, provisioned.redirectPath), requestUrl.origin),
  );
}
