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

export const withCrmRead = (
  request: NextRequest,
  organisationId: string,
  handler: Parameters<typeof withApiHandler>[1],
) => withApiHandler(request, handler, { organisationId, permission: PERMISSIONS["crm.read"] });

export const withCrmCreate = (
  request: NextRequest,
  organisationId: string,
  handler: Parameters<typeof withApiHandler>[1],
) => withApiHandler(request, handler, { organisationId, permission: PERMISSIONS["crm.create"] });

export const withCrmEdit = (
  request: NextRequest,
  organisationId: string,
  handler: Parameters<typeof withApiHandler>[1],
) => withApiHandler(request, handler, { organisationId, permission: PERMISSIONS["crm.edit"] });

export const withCrmAssignOwner = (
  request: NextRequest,
  organisationId: string,
  handler: Parameters<typeof withApiHandler>[1],
) => withApiHandler(request, handler, { organisationId, permission: PERMISSIONS["crm.assignOwner"] });

export const withCrmManageDuplicates = (
  request: NextRequest,
  organisationId: string,
  handler: Parameters<typeof withApiHandler>[1],
) =>
  withApiHandler(request, handler, {
    organisationId,
    permission: PERMISSIONS["crm.manageDuplicates"],
  });

export const withCrmMergeRecords = (
  request: NextRequest,
  organisationId: string,
  handler: Parameters<typeof withApiHandler>[1],
) => withApiHandler(request, handler, { organisationId, permission: PERMISSIONS["crm.mergeRecords"] });

export const withCrmManageCustomFields = (
  request: NextRequest,
  organisationId: string,
  handler: Parameters<typeof withApiHandler>[1],
) =>
  withApiHandler(request, handler, {
    organisationId,
    permission: PERMISSIONS["crm.manageCustomFields"],
  });

export const withCrmExport = (
  request: NextRequest,
  organisationId: string,
  handler: Parameters<typeof withApiHandler>[1],
) => withApiHandler(request, handler, { organisationId, permission: PERMISSIONS["crm.export"] });

export const withCrmManageConsent = (
  request: NextRequest,
  organisationId: string,
  handler: Parameters<typeof withApiHandler>[1],
) =>
  withApiHandler(request, handler, {
    organisationId,
    permission: PERMISSIONS["crm.manageConsent"],
  });

export const withCrmArchive = (
  request: NextRequest,
  organisationId: string,
  handler: Parameters<typeof withApiHandler>[1],
) => withApiHandler(request, handler, { organisationId, permission: PERMISSIONS["crm.archive"] });
