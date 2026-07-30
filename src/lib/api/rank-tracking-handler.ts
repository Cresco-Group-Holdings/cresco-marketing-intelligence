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

export const withRankTrackingRead = (request: NextRequest, organisationId: string, handler: Parameters<typeof withApiHandler>[1]) =>
  withApiHandler(request, handler, { organisationId, permission: PERMISSIONS["rankTracking.read"] });

export const withRankTrackingManage = (request: NextRequest, organisationId: string, handler: Parameters<typeof withApiHandler>[1]) =>
  withApiHandler(request, handler, { organisationId, permission: PERMISSIONS["rankTracking.manage"] });

export const withRankTrackingImport = (request: NextRequest, organisationId: string, handler: Parameters<typeof withApiHandler>[1]) =>
  withApiHandler(request, handler, { organisationId, permission: PERMISSIONS["rankTracking.import"] });

export const withContentRefreshRead = (request: NextRequest, organisationId: string, handler: Parameters<typeof withApiHandler>[1]) =>
  withApiHandler(request, handler, { organisationId, permission: PERMISSIONS["contentRefresh.read"] });

export const withContentRefreshManage = (request: NextRequest, organisationId: string, handler: Parameters<typeof withApiHandler>[1]) =>
  withApiHandler(request, handler, { organisationId, permission: PERMISSIONS["contentRefresh.manage"] });
