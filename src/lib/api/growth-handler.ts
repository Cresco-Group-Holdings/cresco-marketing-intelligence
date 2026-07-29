import { NextRequest } from "next/server";
import { withApiHandler, parseBody } from "@/lib/api/handler";
import { createRequestId, handleApiError } from "@/lib/api/response";
import { AppError } from "@/lib/errors";
import { PERMISSIONS } from "@/lib/tenancy/permissions";
import { growthAnalyzeSchema } from "@/lib/validation/growth";
import type { Filters } from "@/server/services/social-analytics-query-service";

export function requireOrganisationId(request: NextRequest) {
  const id =
    request.nextUrl.searchParams.get("organisationId") ?? request.headers.get("x-organisation-id");
  if (!id) throw new AppError("TENANT_CONTEXT_REQUIRED", "Organisation context is required.");
  return id;
}

async function withGrowthPermission(
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

export const withGrowthRead = (
  request: NextRequest,
  handler: Parameters<typeof withApiHandler>[1],
) => withGrowthPermission(request, PERMISSIONS["growth.read"], handler);

export const withGrowthGenerate = (
  request: NextRequest,
  handler: Parameters<typeof withApiHandler>[1],
) => withGrowthPermission(request, PERMISSIONS["growth.generate"], handler);

function rawFilters(request: NextRequest) {
  const read = (key: string) => request.nextUrl.searchParams.get(key) ?? undefined;
  return {
    from: request.nextUrl.searchParams.get("from"),
    to: request.nextUrl.searchParams.get("to"),
    timezone: read("timezone"),
    granularity: read("granularity"),
    provider: read("provider"),
    socialAccountId: read("socialAccountId"),
    projectId: read("projectId"),
    campaign: read("campaign"),
    contentType: read("contentType"),
    contentPillar: read("contentPillar"),
    contentItemId: read("contentItemId"),
    ownerUserId: read("ownerUserId"),
  };
}

export function growthFilters(request: NextRequest): Filters {
  const parsed = parseBody(growthAnalyzeSchema, rawFilters(request));
  return { ...parsed, from: new Date(parsed.from), to: new Date(parsed.to) };
}
