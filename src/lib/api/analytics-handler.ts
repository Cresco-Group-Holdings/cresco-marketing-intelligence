import { NextRequest } from "next/server";
import { withApiHandler } from "@/lib/api/handler";
import { AppError } from "@/lib/errors";
import { PERMISSIONS } from "@/lib/tenancy/permissions";
import { socialAnalyticsQuerySchema } from "@/lib/validation/social-analytics";
import { parseBody } from "@/lib/api/handler";

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

export function analyticsFilters(request: NextRequest) {
  return parseBody(socialAnalyticsQuerySchema, {
    from: request.nextUrl.searchParams.get("from"),
    to: request.nextUrl.searchParams.get("to"),
    provider: request.nextUrl.searchParams.get("provider") ?? undefined,
    socialAccountId: request.nextUrl.searchParams.get("socialAccountId") ?? undefined,
    projectId: request.nextUrl.searchParams.get("projectId") ?? undefined,
    campaign: request.nextUrl.searchParams.get("campaign") ?? undefined,
    contentType: request.nextUrl.searchParams.get("contentType") ?? undefined,
    contentItemId: request.nextUrl.searchParams.get("contentItemId") ?? undefined,
    ownerUserId: request.nextUrl.searchParams.get("ownerUserId") ?? undefined,
  });
}
