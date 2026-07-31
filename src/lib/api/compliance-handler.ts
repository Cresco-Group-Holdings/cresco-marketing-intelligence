import { NextRequest } from "next/server";
import { withApiHandler } from "@/lib/api/handler";
import { createRequestId, handleApiError } from "@/lib/api/response";
import { AppError } from "@/lib/errors";
import { PERMISSIONS } from "@/lib/tenancy/permissions";

export function requireOrganisationId(request: NextRequest) {
  const id =
    request.nextUrl.searchParams.get("organisationId") ?? request.headers.get("x-organisation-id");
  if (!id) throw new AppError("TENANT_CONTEXT_REQUIRED", "Organisation context is required.");
  return id;
}

async function withCompliancePermission(
  request: NextRequest,
  permission: (typeof PERMISSIONS)[keyof typeof PERMISSIONS],
  handler: Parameters<typeof withApiHandler>[1],
) {
  const requestId = createRequestId();
  try {
    const organisationId = requireOrganisationId(request);
    return withApiHandler(request, handler, {
      organisationId,
      permission,
    });
  } catch (error) {
    return handleApiError(error, requestId);
  }
}

export const withComplianceRead = (
  request: NextRequest,
  handler: Parameters<typeof withApiHandler>[1],
) => withCompliancePermission(request, PERMISSIONS["compliance.read"], handler);

export const withComplianceWrite = (
  request: NextRequest,
  handler: Parameters<typeof withApiHandler>[1],
) => withCompliancePermission(request, PERMISSIONS["compliance.write"], handler);

export const withComplianceOverride = (
  request: NextRequest,
  handler: Parameters<typeof withApiHandler>[1],
) => withCompliancePermission(request, PERMISSIONS["compliance.override"], handler);
