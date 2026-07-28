import { NextRequest } from "next/server";
import { withApiHandler } from "@/lib/api/handler";
import { AppError } from "@/lib/errors";
import { PERMISSIONS } from "@/lib/tenancy/permissions";

export function requireOrganisationId(request: NextRequest): string {
  const organisationId =
    request.nextUrl.searchParams.get("organisationId") ??
    request.headers.get("x-organisation-id");

  if (!organisationId) {
    throw new AppError("TENANT_CONTEXT_REQUIRED", "Organisation context is required.");
  }

  return organisationId;
}

export function withSocialConnectionsRead(
  request: NextRequest,
  organisationId: string,
  handler: Parameters<typeof withApiHandler>[1],
) {
  return withApiHandler(request, handler, {
    organisationId,
    permission: PERMISSIONS["socialConnections.read"],
  });
}

export function withSocialConnectionsCreate(
  request: NextRequest,
  organisationId: string,
  handler: Parameters<typeof withApiHandler>[1],
) {
  return withApiHandler(request, handler, {
    organisationId,
    permission: PERMISSIONS["socialConnections.create"],
  });
}

export function withSocialConnectionsReconnect(
  request: NextRequest,
  organisationId: string,
  handler: Parameters<typeof withApiHandler>[1],
) {
  return withApiHandler(request, handler, {
    organisationId,
    permission: PERMISSIONS["socialConnections.reconnect"],
  });
}

export function withSocialConnectionsDisconnect(
  request: NextRequest,
  organisationId: string,
  handler: Parameters<typeof withApiHandler>[1],
) {
  return withApiHandler(request, handler, {
    organisationId,
    permission: PERMISSIONS["socialConnections.disconnect"],
  });
}

export function withSocialAccountsAssign(
  request: NextRequest,
  organisationId: string,
  handler: Parameters<typeof withApiHandler>[1],
) {
  return withApiHandler(request, handler, {
    organisationId,
    permission: PERMISSIONS["socialAccounts.assign"],
  });
}
