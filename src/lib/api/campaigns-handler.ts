import { NextRequest } from "next/server";
import { parseBody, withApiHandler } from "@/lib/api/handler";
import { AppError } from "@/lib/errors";
import { PERMISSIONS } from "@/lib/tenancy/permissions";
import { campaignListFiltersSchema } from "@/lib/validation/campaigns";

export function requireOrganisationId(request: NextRequest) {
  const id =
    request.nextUrl.searchParams.get("organisationId") ?? request.headers.get("x-organisation-id");
  if (!id) throw new AppError("TENANT_CONTEXT_REQUIRED", "Organisation context is required.");
  return id;
}

export const withCampaignRead = (
  request: NextRequest,
  organisationId: string,
  handler: Parameters<typeof withApiHandler>[1],
) =>
  withApiHandler(request, handler, {
    organisationId,
    permission: PERMISSIONS["campaign.read"],
  });

export const withCampaignCreate = (
  request: NextRequest,
  organisationId: string,
  handler: Parameters<typeof withApiHandler>[1],
) =>
  withApiHandler(request, handler, {
    organisationId,
    permission: PERMISSIONS["campaign.create"],
  });

export const withCampaignUpdate = (
  request: NextRequest,
  organisationId: string,
  handler: Parameters<typeof withApiHandler>[1],
) =>
  withApiHandler(request, handler, {
    organisationId,
    permission: PERMISSIONS["campaign.update"],
  });

export const withCampaignTransition = (
  request: NextRequest,
  organisationId: string,
  handler: Parameters<typeof withApiHandler>[1],
) =>
  withApiHandler(request, handler, {
    organisationId,
    permission: PERMISSIONS["campaign.transition"],
  });

export const withCampaignArchive = (
  request: NextRequest,
  organisationId: string,
  handler: Parameters<typeof withApiHandler>[1],
) =>
  withApiHandler(request, handler, {
    organisationId,
    permission: PERMISSIONS["campaign.archive"],
  });

export const withCampaignRestore = (
  request: NextRequest,
  organisationId: string,
  handler: Parameters<typeof withApiHandler>[1],
) =>
  withApiHandler(request, handler, {
    organisationId,
    permission: PERMISSIONS["campaign.restore"],
  });

export const withCampaignManageMembers = (
  request: NextRequest,
  organisationId: string,
  handler: Parameters<typeof withApiHandler>[1],
) =>
  withApiHandler(request, handler, {
    organisationId,
    permission: PERMISSIONS["campaign.manage_members"],
  });

export const withCampaignManageKpis = (
  request: NextRequest,
  organisationId: string,
  handler: Parameters<typeof withApiHandler>[1],
) =>
  withApiHandler(request, handler, {
    organisationId,
    permission: PERMISSIONS["campaign.manage_kpis"],
  });

export function campaignListFilters(request: NextRequest) {
  return parseBody(
    campaignListFiltersSchema,
    Object.fromEntries(request.nextUrl.searchParams.entries()),
  );
}
