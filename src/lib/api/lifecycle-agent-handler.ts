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

export const withLifecycleAgentRead = (
  request: NextRequest,
  organisationId: string,
  handler: Parameters<typeof withApiHandler>[1],
) =>
  withApiHandler(request, handler, { organisationId, permission: PERMISSIONS["lifecycleAgent.read"] });

export const withLifecycleAgentRun = (
  request: NextRequest,
  organisationId: string,
  handler: Parameters<typeof withApiHandler>[1],
) =>
  withApiHandler(request, handler, { organisationId, permission: PERMISSIONS["lifecycleAgent.run"] });

export const withLifecycleAgentApprove = (
  request: NextRequest,
  organisationId: string,
  handler: Parameters<typeof withApiHandler>[1],
) =>
  withApiHandler(request, handler, {
    organisationId,
    permission: PERMISSIONS["lifecycleAgent.approve"],
  });

export const withLifecycleAgentFeedback = (
  request: NextRequest,
  organisationId: string,
  handler: Parameters<typeof withApiHandler>[1],
) =>
  withApiHandler(request, handler, {
    organisationId,
    permission: PERMISSIONS["lifecycleAgent.feedback"],
  });

export const withLifecycleAgentDraft = (
  request: NextRequest,
  organisationId: string,
  handler: Parameters<typeof withApiHandler>[1],
) =>
  withApiHandler(request, handler, {
    organisationId,
    permission: PERMISSIONS["lifecycleAgent.draft"],
  });

export const withLifecycleAgentViewHistory = (
  request: NextRequest,
  organisationId: string,
  handler: Parameters<typeof withApiHandler>[1],
) =>
  withApiHandler(request, handler, {
    organisationId,
    permission: PERMISSIONS["lifecycleAgent.viewHistory"],
  });
