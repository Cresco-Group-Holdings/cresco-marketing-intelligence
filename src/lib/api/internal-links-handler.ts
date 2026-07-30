import { NextRequest } from "next/server";
import { withApiHandler } from "@/lib/api/handler";
import { AppError } from "@/lib/errors";
import { PERMISSIONS } from "@/lib/tenancy/permissions";

export function requireOrganisationId(request: NextRequest) {
  const id =
    request.nextUrl.searchParams.get("organisationId") ?? request.headers.get("x-organisation-id");
  if (!id) throw new AppError("TENANT_CONTEXT_REQUIRED", "Organisation context is required.");
  return id;
}

export const withInternalLinksRead = (request: NextRequest, organisationId: string, handler: Parameters<typeof withApiHandler>[1]) =>
  withApiHandler(request, handler, { organisationId, permission: PERMISSIONS["internalLinks.read"] });

export const withInternalLinksManage = (request: NextRequest, organisationId: string, handler: Parameters<typeof withApiHandler>[1]) =>
  withApiHandler(request, handler, { organisationId, permission: PERMISSIONS["internalLinks.manage"] });

export const withInternalLinksBuild = (request: NextRequest, organisationId: string, handler: Parameters<typeof withApiHandler>[1]) =>
  withApiHandler(request, handler, { organisationId, permission: PERMISSIONS["internalLinks.build"] });

export const withInternalLinksPropose = (request: NextRequest, organisationId: string, handler: Parameters<typeof withApiHandler>[1]) =>
  withApiHandler(request, handler, { organisationId, permission: PERMISSIONS["internalLinks.propose"] });
