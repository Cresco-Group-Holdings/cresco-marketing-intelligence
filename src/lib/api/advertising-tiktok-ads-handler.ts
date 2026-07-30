import { NextRequest } from "next/server";
import { withApiHandler } from "@/lib/api/handler";
import { AppError } from "@/lib/errors";
import { PERMISSIONS } from "@/lib/tenancy/permissions";

export function requireOrganisationId(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("organisationId") ?? request.headers.get("x-organisation-id");
  if (!id) throw new AppError("TENANT_CONTEXT_REQUIRED", "Organisation context is required.");
  return id;
}

export const withAdvertisingTikTokAdsRead = (request: NextRequest, organisationId: string, handler: Parameters<typeof withApiHandler>[1]) =>
  withApiHandler(request, handler, { organisationId, permission: PERMISSIONS["advertisingTikTokAds.read"] });

export const withAdvertisingTikTokAdsConnect = (request: NextRequest, organisationId: string, handler: Parameters<typeof withApiHandler>[1]) =>
  withApiHandler(request, handler, { organisationId, permission: PERMISSIONS["advertisingTikTokAds.connect"] });

export const withAdvertisingTikTokAdsDraft = (request: NextRequest, organisationId: string, handler: Parameters<typeof withApiHandler>[1]) =>
  withApiHandler(request, handler, { organisationId, permission: PERMISSIONS["advertisingTikTokAds.draft"] });

export const withAdvertisingTikTokAdsValidate = (request: NextRequest, organisationId: string, handler: Parameters<typeof withApiHandler>[1]) =>
  withApiHandler(request, handler, { organisationId, permission: PERMISSIONS["advertisingTikTokAds.validate"] });

export const withAdvertisingTikTokAdsLaunch = (request: NextRequest, organisationId: string, handler: Parameters<typeof withApiHandler>[1]) =>
  withApiHandler(request, handler, { organisationId, permission: PERMISSIONS["advertisingTikTokAds.launch"] });

export const withAdvertisingTikTokAdsManage = (request: NextRequest, organisationId: string, handler: Parameters<typeof withApiHandler>[1]) =>
  withApiHandler(request, handler, { organisationId, permission: PERMISSIONS["advertisingTikTokAds.manage"] });
