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

export const withOpportunitiesRead = (request: NextRequest, organisationId: string, handler: Parameters<typeof withApiHandler>[1]) =>
  withApiHandler(request, handler, { organisationId, permission: PERMISSIONS["opportunities.read"] });

export const withOpportunitiesCreate = (request: NextRequest, organisationId: string, handler: Parameters<typeof withApiHandler>[1]) =>
  withApiHandler(request, handler, { organisationId, permission: PERMISSIONS["opportunities.create"] });

export const withOpportunitiesEdit = (request: NextRequest, organisationId: string, handler: Parameters<typeof withApiHandler>[1]) =>
  withApiHandler(request, handler, { organisationId, permission: PERMISSIONS["opportunities.edit"] });

export const withOpportunitiesMove = (request: NextRequest, organisationId: string, handler: Parameters<typeof withApiHandler>[1]) =>
  withApiHandler(request, handler, { organisationId, permission: PERMISSIONS["opportunities.move"] });

export const withOpportunitiesMarkWon = (request: NextRequest, organisationId: string, handler: Parameters<typeof withApiHandler>[1]) =>
  withApiHandler(request, handler, { organisationId, permission: PERMISSIONS["opportunities.markWon"] });

export const withOpportunitiesMarkLost = (request: NextRequest, organisationId: string, handler: Parameters<typeof withApiHandler>[1]) =>
  withApiHandler(request, handler, { organisationId, permission: PERMISSIONS["opportunities.markLost"] });

export const withPipelinesManage = (request: NextRequest, organisationId: string, handler: Parameters<typeof withApiHandler>[1]) =>
  withApiHandler(request, handler, { organisationId, permission: PERMISSIONS["pipelines.manage"] });

export const withForecastRead = (request: NextRequest, organisationId: string, handler: Parameters<typeof withApiHandler>[1]) =>
  withApiHandler(request, handler, { organisationId, permission: PERMISSIONS["forecast.read"] });
