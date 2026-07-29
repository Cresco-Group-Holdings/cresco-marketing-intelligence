import { NextRequest } from "next/server";
import { withApiHandler, parseBody } from "@/lib/api/handler";
import { createRequestId, handleApiError } from "@/lib/api/response";
import { AppError } from "@/lib/errors";
import { PERMISSIONS } from "@/lib/tenancy/permissions";
import { experimentListFiltersSchema } from "@/lib/validation/experiments";

export function requireOrganisationId(request: NextRequest) {
  const id =
    request.nextUrl.searchParams.get("organisationId") ?? request.headers.get("x-organisation-id");
  if (!id) throw new AppError("TENANT_CONTEXT_REQUIRED", "Organisation context is required.");
  return id;
}

async function withExperimentPermission(
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

export const withExperimentsRead = (
  request: NextRequest,
  handler: Parameters<typeof withApiHandler>[1],
) => withExperimentPermission(request, PERMISSIONS["experiments.read"], handler);

export const withExperimentsWrite = (
  request: NextRequest,
  handler: Parameters<typeof withApiHandler>[1],
) => withExperimentPermission(request, PERMISSIONS["experiments.write"], handler);

export function experimentListFilters(request: NextRequest) {
  return parseBody(
    experimentListFiltersSchema,
    Object.fromEntries(request.nextUrl.searchParams.entries()),
  );
}
