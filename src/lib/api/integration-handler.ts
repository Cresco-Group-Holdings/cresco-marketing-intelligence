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

export const withIntegrationRead = (
  request: NextRequest,
  organisationId: string,
  handler: Parameters<typeof withApiHandler>[1],
) => withApiHandler(request, handler, { organisationId, permission: PERMISSIONS["integration.read"] });

export const withIntegrationCreate = (
  request: NextRequest,
  organisationId: string,
  handler: Parameters<typeof withApiHandler>[1],
) => withApiHandler(request, handler, { organisationId, permission: PERMISSIONS["integration.create"] });

export const withIntegrationUpdate = (
  request: NextRequest,
  organisationId: string,
  handler: Parameters<typeof withApiHandler>[1],
) => withApiHandler(request, handler, { organisationId, permission: PERMISSIONS["integration.update"] });

export const withIntegrationConnect = (
  request: NextRequest,
  organisationId: string,
  handler: Parameters<typeof withApiHandler>[1],
) => withApiHandler(request, handler, { organisationId, permission: PERMISSIONS["integration.connect"] });

export const withIntegrationDisconnect = (
  request: NextRequest,
  organisationId: string,
  handler: Parameters<typeof withApiHandler>[1],
) => withApiHandler(request, handler, { organisationId, permission: PERMISSIONS["integration.disconnect"] });

export const withIntegrationVerify = (
  request: NextRequest,
  organisationId: string,
  handler: Parameters<typeof withApiHandler>[1],
) => withApiHandler(request, handler, { organisationId, permission: PERMISSIONS["integration.verify"] });

export const withIntegrationSync = (
  request: NextRequest,
  organisationId: string,
  handler: Parameters<typeof withApiHandler>[1],
) => withApiHandler(request, handler, { organisationId, permission: PERMISSIONS["integration.sync"] });

export const withIntegrationManageWebhooks = (
  request: NextRequest,
  organisationId: string,
  handler: Parameters<typeof withApiHandler>[1],
) =>
  withApiHandler(request, handler, {
    organisationId,
    permission: PERMISSIONS["integration.manage_webhooks"],
  });
