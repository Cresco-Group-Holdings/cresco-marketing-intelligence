import { NextRequest } from "next/server";
import { withApiHandler } from "@/lib/api/handler";
import { AppError } from "@/lib/errors";
import { PERMISSIONS, type Permission } from "@/lib/tenancy/permissions";

export function requireOrganisationId(request: NextRequest): string {
  const organisationId =
    request.nextUrl.searchParams.get("organisationId") ??
    request.headers.get("x-organisation-id");

  if (!organisationId) {
    throw new AppError("TENANT_CONTEXT_REQUIRED", "Organisation context is required.");
  }

  return organisationId;
}

function withInboxPermission(
  request: NextRequest,
  organisationId: string,
  permission: Permission,
  handler: Parameters<typeof withApiHandler>[1],
) {
  return withApiHandler(request, handler, { organisationId, permission });
}

export const withInboxRead = (
  request: NextRequest,
  organisationId: string,
  handler: Parameters<typeof withApiHandler>[1],
) => withInboxPermission(request, organisationId, PERMISSIONS["socialInbox.read"], handler);

export const withInboxReply = (
  request: NextRequest,
  organisationId: string,
  handler: Parameters<typeof withApiHandler>[1],
) => withInboxPermission(request, organisationId, PERMISSIONS["socialInbox.reply"], handler);

export const withInboxAssign = (
  request: NextRequest,
  organisationId: string,
  handler: Parameters<typeof withApiHandler>[1],
) => withInboxPermission(request, organisationId, PERMISSIONS["socialInbox.assign"], handler);

export const withInboxModerate = (
  request: NextRequest,
  organisationId: string,
  handler: Parameters<typeof withApiHandler>[1],
) => withInboxPermission(request, organisationId, PERMISSIONS["socialInbox.moderate"], handler);

export const withInboxResolve = (
  request: NextRequest,
  organisationId: string,
  handler: Parameters<typeof withApiHandler>[1],
) => withInboxPermission(request, organisationId, PERMISSIONS["socialInbox.resolve"], handler);

export const withInboxExport = (
  request: NextRequest,
  organisationId: string,
  handler: Parameters<typeof withApiHandler>[1],
) => withInboxPermission(request, organisationId, PERMISSIONS["socialInbox.export"], handler);
