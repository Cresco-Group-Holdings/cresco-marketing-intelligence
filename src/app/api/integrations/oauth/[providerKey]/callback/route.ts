import { NextRequest, NextResponse } from "next/server";
import { resolveOAuthCallbackUrl } from "@/lib/integrations/oauth/security";
import { oauthCallbackService } from "@/server/services/oauth-callback-service";

type Params = { params: Promise<{ providerKey: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { providerKey } = await params;
  const searchParams = request.nextUrl.searchParams;
  const redirectUri = resolveOAuthCallbackUrl(providerKey);

  try {
    const result = await oauthCallbackService.handleCallback({
      providerKey,
      code: searchParams.get("code") ?? undefined,
      state: searchParams.get("state") ?? undefined,
      error: searchParams.get("error") ?? undefined,
      errorDescription: searchParams.get("error_description") ?? undefined,
      redirectUri,
      mode: searchParams.get("mode") ?? undefined,
    });

    const successUrl = new URL(result.returnPath, request.nextUrl.origin);
    successUrl.searchParams.set("integration", "success");
    successUrl.searchParams.set("connectionId", result.connectionId);
    if (result.missingScopes.length > 0) {
      successUrl.searchParams.set("missingScopes", result.missingScopes.join(","));
    }
    return NextResponse.redirect(successUrl);
  } catch (error) {
    const message = error instanceof Error ? error.message : "OAuth callback failed.";
    const failureUrl = new URL("/integrations/callback", request.nextUrl.origin);
    failureUrl.searchParams.set("integration", "error");
    failureUrl.searchParams.set("provider", providerKey);
    failureUrl.searchParams.set("message", message);
    return NextResponse.redirect(failureUrl);
  }
}
