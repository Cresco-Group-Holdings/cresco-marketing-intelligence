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

export const withLeadScoringRead = (
  request: NextRequest,
  organisationId: string,
  handler: Parameters<typeof withApiHandler>[1],
) =>
  withApiHandler(request, handler, { organisationId, permission: PERMISSIONS["leadScoring.read"] });

export const withLeadScoringCreate = (
  request: NextRequest,
  organisationId: string,
  handler: Parameters<typeof withApiHandler>[1],
) =>
  withApiHandler(request, handler, { organisationId, permission: PERMISSIONS["leadScoring.create"] });

export const withLeadScoringEdit = (
  request: NextRequest,
  organisationId: string,
  handler: Parameters<typeof withApiHandler>[1],
) =>
  withApiHandler(request, handler, { organisationId, permission: PERMISSIONS["leadScoring.edit"] });

export const withLeadScoringApprove = (
  request: NextRequest,
  organisationId: string,
  handler: Parameters<typeof withApiHandler>[1],
) =>
  withApiHandler(request, handler, { organisationId, permission: PERMISSIONS["leadScoring.approve"] });

export const withLeadScoringActivate = (
  request: NextRequest,
  organisationId: string,
  handler: Parameters<typeof withApiHandler>[1],
) =>
  withApiHandler(request, handler, { organisationId, permission: PERMISSIONS["leadScoring.activate"] });

export const withLeadScoringSimulate = (
  request: NextRequest,
  organisationId: string,
  handler: Parameters<typeof withApiHandler>[1],
) =>
  withApiHandler(request, handler, { organisationId, permission: PERMISSIONS["leadScoring.simulate"] });

export const withLeadScoringOverride = (
  request: NextRequest,
  organisationId: string,
  handler: Parameters<typeof withApiHandler>[1],
) =>
  withApiHandler(request, handler, { organisationId, permission: PERMISSIONS["leadScoring.override"] });

export const withLeadScoringAnalytics = (
  request: NextRequest,
  organisationId: string,
  handler: Parameters<typeof withApiHandler>[1],
) =>
  withApiHandler(request, handler, {
    organisationId,
    permission: PERMISSIONS["leadScoring.viewAnalytics"],
  });
