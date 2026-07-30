import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { getServerEnv } from "@/lib/environment";

function connectorRedirectPath(connectorType: string): string {
  if (connectorType === "GOOGLE_SEARCH_CONSOLE") return "/connectors/google-search-console";
  if (connectorType === "GOOGLE_ANALYTICS_4") return "/connectors/google-analytics";
  return "/connectors";
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const state = searchParams.get("state");
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const connectorType = searchParams.get("connectorType") ?? "GOOGLE_ANALYTICS_4";

  const appUrl = getServerEnv().APP_URL;
  const redirectPath = connectorRedirectPath(connectorType);

  if (error || !state || !code) {
    const redirect = new URL(`${appUrl}${redirectPath}`);
    redirect.searchParams.set("error", error ?? "oauth_cancelled");
    return NextResponse.redirect(redirect);
  }

  const oauthState = await prisma.connectorOAuthState.findUnique({ where: { state } });
  if (!oauthState) {
    const redirect = new URL(`${appUrl}${redirectPath}`);
    redirect.searchParams.set("error", "invalid_state");
    return NextResponse.redirect(redirect);
  }

  const account = await prisma.connectorAccount.findFirst({
    where: {
      organisationId: oauthState.organisationId,
      brandId: oauthState.brandId,
      connectorType: oauthState.connectorType,
    },
  });

  if (!account) {
    const redirect = new URL(`${appUrl}${redirectPath}`);
    redirect.searchParams.set("error", "account_not_found");
    return NextResponse.redirect(redirect);
  }

  const redirect = new URL(`${appUrl}${redirectPath}`);
  redirect.searchParams.set("state", state);
  redirect.searchParams.set("code", code);
  redirect.searchParams.set("connectorType", oauthState.connectorType);
  redirect.searchParams.set("brandId", oauthState.brandId);
  redirect.searchParams.set("organisationId", oauthState.organisationId);
  return NextResponse.redirect(redirect);
}
