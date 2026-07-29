import { NextRequest } from "next/server";
import { withApiHandler } from "@/lib/api/handler";
import { AppError } from "@/lib/errors";
import { PERMISSIONS, type Permission } from "@/lib/tenancy/permissions";

export function requireOrganisationId(request: NextRequest): string {
  const organisationId =
    request.nextUrl.searchParams.get("organisationId") ?? request.headers.get("x-organisation-id");

  if (!organisationId) {
    throw new AppError("TENANT_CONTEXT_REQUIRED", "Organisation context is required.");
  }

  return organisationId;
}

function withContentPermission(
  request: NextRequest,
  organisationId: string,
  permission: Permission,
  handler: Parameters<typeof withApiHandler>[1],
) {
  return withApiHandler(request, handler, { organisationId, permission });
}

export const withContentRead = (
  request: NextRequest,
  organisationId: string,
  handler: Parameters<typeof withApiHandler>[1],
) => withContentPermission(request, organisationId, PERMISSIONS["content.read"], handler);

export const withContentCreate = (
  request: NextRequest,
  organisationId: string,
  handler: Parameters<typeof withApiHandler>[1],
) => withContentPermission(request, organisationId, PERMISSIONS["content.create"], handler);

export const withContentEdit = (
  request: NextRequest,
  organisationId: string,
  handler: Parameters<typeof withApiHandler>[1],
) => withContentPermission(request, organisationId, PERMISSIONS["content.edit"], handler);

export const withContentGenerate = (
  request: NextRequest,
  organisationId: string,
  handler: Parameters<typeof withApiHandler>[1],
) => withContentPermission(request, organisationId, PERMISSIONS["content.generate"], handler);

export const withContentIdeas = (
  request: NextRequest,
  organisationId: string,
  handler: Parameters<typeof withApiHandler>[1],
) => withContentPermission(request, organisationId, PERMISSIONS["content.ideas"], handler);

export const withContentSubmit = (
  request: NextRequest,
  organisationId: string,
  handler: Parameters<typeof withApiHandler>[1],
) =>
  withContentPermission(request, organisationId, PERMISSIONS["content.submitForReview"], handler);

export const withContentApprove = (
  request: NextRequest,
  organisationId: string,
  handler: Parameters<typeof withApiHandler>[1],
) => withContentPermission(request, organisationId, PERMISSIONS["content.approve"], handler);

export const withContentRequestChanges = (
  request: NextRequest,
  organisationId: string,
  handler: Parameters<typeof withApiHandler>[1],
) => withContentPermission(request, organisationId, PERMISSIONS["content.requestChanges"], handler);

export const withContentArchive = (
  request: NextRequest,
  organisationId: string,
  handler: Parameters<typeof withApiHandler>[1],
) => withContentPermission(request, organisationId, PERMISSIONS["content.archive"], handler);
