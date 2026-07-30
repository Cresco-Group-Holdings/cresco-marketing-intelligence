import { NextRequest } from "next/server";
import { withApiHandler, parseBody } from "@/lib/api/handler";
import { createRequestId, handleApiError } from "@/lib/api/response";
import { AppError } from "@/lib/errors";
import { PERMISSIONS } from "@/lib/tenancy/permissions";

export function requireOrganisationId(request: NextRequest) {
  const id =
    request.nextUrl.searchParams.get("organisationId") ?? request.headers.get("x-organisation-id");
  if (!id) throw new AppError("TENANT_CONTEXT_REQUIRED", "Organisation context is required.");
  return id;
}

async function withTrackingPermission(
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

export const withTrackingRead = (
  request: NextRequest,
  handler: Parameters<typeof withApiHandler>[1],
) => withTrackingPermission(request, PERMISSIONS["tracking.read"], handler);

export const withTrackingManage = (
  request: NextRequest,
  handler: Parameters<typeof withApiHandler>[1],
) => withTrackingPermission(request, PERMISSIONS["tracking.manage"], handler);

export const withTrackingViewRaw = (
  request: NextRequest,
  handler: Parameters<typeof withApiHandler>[1],
) => withTrackingPermission(request, PERMISSIONS["tracking.viewRaw"], handler);

export { parseBody };
