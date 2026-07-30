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

export const withFormsRead = (
  request: NextRequest,
  organisationId: string,
  handler: Parameters<typeof withApiHandler>[1],
) => withApiHandler(request, handler, { organisationId, permission: PERMISSIONS["forms.read"] });

export const withFormsCreate = (
  request: NextRequest,
  organisationId: string,
  handler: Parameters<typeof withApiHandler>[1],
) => withApiHandler(request, handler, { organisationId, permission: PERMISSIONS["forms.create"] });

export const withFormsEdit = (
  request: NextRequest,
  organisationId: string,
  handler: Parameters<typeof withApiHandler>[1],
) => withApiHandler(request, handler, { organisationId, permission: PERMISSIONS["forms.edit"] });

export const withFormsPublish = (
  request: NextRequest,
  organisationId: string,
  handler: Parameters<typeof withApiHandler>[1],
) => withApiHandler(request, handler, { organisationId, permission: PERMISSIONS["forms.publish"] });

export const withFormsViewSubmissions = (
  request: NextRequest,
  organisationId: string,
  handler: Parameters<typeof withApiHandler>[1],
) =>
  withApiHandler(request, handler, {
    organisationId,
    permission: PERMISSIONS["forms.viewSubmissions"],
  });
