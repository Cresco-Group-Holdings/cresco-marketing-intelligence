import { NextRequest } from "next/server";
import { withApiHandler } from "@/lib/api/handler";
import { AppError } from "@/lib/errors";
import { PERMISSIONS } from "@/lib/tenancy/permissions";
import {
  socialAnalyticsAttributionSchema,
  socialAnalyticsQuerySchema,
} from "@/lib/validation/social-analytics";
import { parseBody } from "@/lib/api/handler";
import type { Filters } from "@/server/services/social-analytics-query-service";

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

export const withAnalyticsSync = (
  request: NextRequest,
  organisationId: string,
  handler: Parameters<typeof withApiHandler>[1],
) =>
  withApiHandler(request, handler, {
    organisationId,
    permission: PERMISSIONS["analytics.sync"],
  });

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

/** Parses shared analytics query parameters into service filters with real `Date` boundaries. */
export function analyticsFilters(request: NextRequest): Filters {
  const parsed = parseBody(socialAnalyticsQuerySchema, rawFilters(request));
  return { ...parsed, from: new Date(parsed.from), to: new Date(parsed.to) };
}

export function analyticsAttributionFilters(request: NextRequest) {
  const parsed = parseBody(socialAnalyticsAttributionSchema, {
    ...rawFilters(request),
    dimension: request.nextUrl.searchParams.get("dimension") ?? undefined,
  });
  const { dimension, ...filters } = parsed;
  return {
    dimension,
    filters: { ...filters, from: new Date(filters.from), to: new Date(filters.to) } as Filters,
  };
}
