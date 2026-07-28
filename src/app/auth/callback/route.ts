import { NextResponse } from "next/server";
import { createRequestId } from "@/lib/api/response";
import { AUTH_ERROR_PATH } from "@/lib/auth/constants";
import { authService } from "@/server/services/auth-service";
import { createSupabaseServerClient } from "@/lib/auth/supabase-server";
import { getClientIpAddress } from "@/lib/auth/request";
import { resolveSafeRedirectPath } from "@/lib/security/redirects";
import { resolveAuthenticatedRedirect } from "@/lib/auth/post-auth";
import { logger } from "@/lib/logging";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const requestId = createRequestId();
  const ipAddress = getClientIpAddress(request);
  const code = requestUrl.searchParams.get("code");
  const error = requestUrl.searchParams.get("error");
  const errorDescription = requestUrl.searchParams.get("error_description");
  const requestedRedirect = requestUrl.searchParams.get("redirect");
  const type = requestUrl.searchParams.get("type");

  if (error) {
    logger.warn("auth.callback.oauth_error", {
      requestId,
      error,
      errorDescription,
    });

    const errorUrl = new URL(AUTH_ERROR_PATH, requestUrl.origin);
    errorUrl.searchParams.set("code", "oauth_failed");
    return NextResponse.redirect(errorUrl);
  }

  if (!code) {
    const errorUrl = new URL(AUTH_ERROR_PATH, requestUrl.origin);
    errorUrl.searchParams.set("code", "missing_code");
    return NextResponse.redirect(errorUrl);
  }

  const supabase = await createSupabaseServerClient();
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    logger.warn("auth.callback.exchange_failed", {
      requestId,
      message: exchangeError.message,
    });

    const errorUrl = new URL(AUTH_ERROR_PATH, requestUrl.origin);
    errorUrl.searchParams.set("code", "invalid_callback");
    return NextResponse.redirect(errorUrl);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    const errorUrl = new URL(AUTH_ERROR_PATH, requestUrl.origin);
    errorUrl.searchParams.set("code", "missing_user");
    return NextResponse.redirect(errorUrl);
  }

  const provisioned = await authService.provisionFromAuthUser(user, { requestId, ipAddress });

  const provider = user.app_metadata?.provider;
  if (provider && provider !== "email") {
    await authService.recordOAuthConnected(provisioned.userProfileId, String(provider), {
      requestId,
      ipAddress,
    });
  }

  if (type === "signup" || user.email_confirmed_at) {
    await authService.recordEmailVerified(provisioned.userProfileId, { requestId, ipAddress });
  }

  await authService.recordLoginSucceeded(
    provisioned.userProfileId,
    { requestId, ipAddress },
    { provider: provider ?? "email" },
  );

  const redirectPath = resolveAuthenticatedRedirect(
    requestedRedirect,
    provisioned.redirectPath,
  );

  return NextResponse.redirect(
    new URL(resolveSafeRedirectPath(redirectPath, provisioned.redirectPath), requestUrl.origin),
  );
}
