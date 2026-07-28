import { NextResponse } from "next/server";
import { createRequestId } from "@/lib/api/response";
import { resolveApiUser } from "@/lib/api/handler";
import { AppError } from "@/lib/errors";
import { ensureSocialAdaptersRegistered } from "@/lib/social/bootstrap";
import { resolveSafeRedirectPath } from "@/lib/security/redirects";
import { socialConnectionService } from "@/server/services/social-connection-service";
import { socialOAuthService } from "@/server/services/social-oauth-service";
import { logger } from "@/lib/logging";

export async function GET(request: Request) {
  ensureSocialAdaptersRegistered();
  const requestId = createRequestId();
  const requestUrl = new URL(request.url);
  const state = requestUrl.searchParams.get("state");
  const code = requestUrl.searchParams.get("code");
  const error = requestUrl.searchParams.get("error");
  const errorDescription = requestUrl.searchParams.get("error_description");

  const redirectBase = resolveSafeRedirectPath(
    "/social/connections",
    "/social/connections",
  );

  if (error) {
    logger.warn("social.oauth.callback_error", { requestId, error, errorDescription });
    const redirectUrl = new URL(redirectBase, requestUrl.origin);
    redirectUrl.searchParams.set("error", "oauth_failed");
    return NextResponse.redirect(redirectUrl);
  }

  if (!state || !code) {
    const redirectUrl = new URL(redirectBase, requestUrl.origin);
    redirectUrl.searchParams.set("error", "missing_parameters");
    return NextResponse.redirect(redirectUrl);
  }

  try {
    const user = await resolveApiUser();
    const result = await socialOAuthService.handleCallback({
      state,
      code,
      userId: user.userProfileId,
    });

    await socialConnectionService.recordConnectionCompleted({
      connectionId: result.socialConnectionId,
      organisationId: result.organisationId,
      projectId: result.projectId,
      actorUserId: user.userProfileId,
      provider: result.provider,
      requestId,
    });

    const redirectUrl = new URL(redirectBase, requestUrl.origin);
    redirectUrl.searchParams.set("connectionId", result.socialConnectionId);
    redirectUrl.searchParams.set("step", "select-account");
    redirectUrl.searchParams.delete("code");
    redirectUrl.searchParams.delete("state");
    return NextResponse.redirect(redirectUrl);
  } catch (callbackError) {
    const message =
      callbackError instanceof AppError
        ? callbackError.message
        : "Social OAuth callback failed.";

    logger.warn("social.oauth.callback_failed", { requestId, message });

    const redirectUrl = new URL(redirectBase, requestUrl.origin);
    redirectUrl.searchParams.set("error", "callback_failed");
    redirectUrl.searchParams.delete("code");
    redirectUrl.searchParams.delete("state");
    return NextResponse.redirect(redirectUrl);
  }
}
