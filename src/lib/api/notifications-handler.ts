import { NextRequest } from "next/server";
import { withApiHandler } from "@/lib/api/handler";
import { parseBody } from "@/lib/api/handler";
import { AppError } from "@/lib/errors";
import { PERMISSIONS } from "@/lib/tenancy/permissions";
import {
  notificationListFiltersSchema,
  operationalAlertFiltersSchema,
} from "@/lib/validation/notifications";

export function requireOrganisationId(request: NextRequest) {
  const id =
    request.nextUrl.searchParams.get("organisationId") ?? request.headers.get("x-organisation-id");
  if (!id) throw new AppError("TENANT_CONTEXT_REQUIRED", "Organisation context is required.");
  return id;
}

export const withNotificationsRead = (
  request: NextRequest,
  organisationId: string,
  handler: Parameters<typeof withApiHandler>[1],
) =>
  withApiHandler(request, handler, {
    organisationId,
    permission: PERMISSIONS["notifications.read"],
  });

export const withNotificationsWrite = (
  request: NextRequest,
  organisationId: string,
  handler: Parameters<typeof withApiHandler>[1],
) =>
  withApiHandler(request, handler, {
    organisationId,
    permission: PERMISSIONS["notifications.write"],
  });

export const withOperationsRead = (
  request: NextRequest,
  organisationId: string,
  handler: Parameters<typeof withApiHandler>[1],
) =>
  withApiHandler(request, handler, {
    organisationId,
    permission: PERMISSIONS["operations.read"],
  });

export const withOperationsRecover = (
  request: NextRequest,
  organisationId: string,
  handler: Parameters<typeof withApiHandler>[1],
) =>
  withApiHandler(request, handler, {
    organisationId,
    permission: PERMISSIONS["operations.recover"],
  });

export function notificationFilters(request: NextRequest) {
  return parseBody(
    notificationListFiltersSchema,
    Object.fromEntries(request.nextUrl.searchParams.entries()),
  );
}

export function operationalAlertFilters(request: NextRequest) {
  return parseBody(
    operationalAlertFiltersSchema,
    Object.fromEntries(request.nextUrl.searchParams.entries()),
  );
}
