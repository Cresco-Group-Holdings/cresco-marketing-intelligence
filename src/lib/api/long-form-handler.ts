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

export const withLongFormRead = (
  request: NextRequest,
  organisationId: string,
  handler: Parameters<typeof withApiHandler>[1],
) => withApiHandler(request, handler, { organisationId, permission: PERMISSIONS["longForm.read"] });

export const withLongFormManage = (
  request: NextRequest,
  organisationId: string,
  handler: Parameters<typeof withApiHandler>[1],
) => withApiHandler(request, handler, { organisationId, permission: PERMISSIONS["longForm.manage"] });

export const withLongFormGenerate = (
  request: NextRequest,
  organisationId: string,
  handler: Parameters<typeof withApiHandler>[1],
) => withApiHandler(request, handler, { organisationId, permission: PERMISSIONS["longForm.generate"] });

export const withLongFormReview = (
  request: NextRequest,
  organisationId: string,
  handler: Parameters<typeof withApiHandler>[1],
) => withApiHandler(request, handler, { organisationId, permission: PERMISSIONS["longForm.review"] });

export const withLongFormExport = (
  request: NextRequest,
  organisationId: string,
  handler: Parameters<typeof withApiHandler>[1],
) => withApiHandler(request, handler, { organisationId, permission: PERMISSIONS["longForm.export"] });
