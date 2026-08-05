import { NextRequest } from "next/server";
import { parseBody, withApiHandler } from "@/lib/api/handler";
import { AppError } from "@/lib/errors";
import { PERMISSIONS } from "@/lib/tenancy/permissions";
import {
  analyticsDashboardFiltersSchema,
  analyticsFactQuerySchema,
} from "@/lib/validation/analytics-core";

export function requireOrganisationId(request: NextRequest) {
  const id =
    request.nextUrl.searchParams.get("organisationId") ?? request.headers.get("x-organisation-id");
  if (!id) throw new AppError("TENANT_CONTEXT_REQUIRED", "Organisation context is required.");
  return id;
}

export const withAnalyticsRead = (
  request: NextRequest,
  organisationId: string,
  handler: Parameters<typeof withApiHandler>[1],
) =>
  withApiHandler(request, handler, {
    organisationId,
    permission: PERMISSIONS["analytics.read"],
  });

export const withAnalyticsImport = (
  request: NextRequest,
  organisationId: string,
  handler: Parameters<typeof withApiHandler>[1],
) =>
  withApiHandler(request, handler, {
    organisationId,
    permission: PERMISSIONS["analytics.import"],
  });

export function analyticsFactQuery(request: NextRequest) {
  return parseBody(
    analyticsFactQuerySchema,
    Object.fromEntries(request.nextUrl.searchParams.entries()),
  );
}

export function analyticsDashboardFilters(request: NextRequest) {
  return parseBody(
    analyticsDashboardFiltersSchema,
    Object.fromEntries(request.nextUrl.searchParams.entries()),
  );
}
