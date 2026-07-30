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

export const withAdvertisingGoogleAdsRead = (request: NextRequest, organisationId: string, handler: Parameters<typeof withApiHandler>[1]) =>
  withApiHandler(request, handler, { organisationId, permission: PERMISSIONS["advertisingGoogleAds.read"] });

export const withAdvertisingGoogleAdsConnect = (request: NextRequest, organisationId: string, handler: Parameters<typeof withApiHandler>[1]) =>
  withApiHandler(request, handler, { organisationId, permission: PERMISSIONS["advertisingGoogleAds.connect"] });

export const withAdvertisingGoogleAdsDraft = (request: NextRequest, organisationId: string, handler: Parameters<typeof withApiHandler>[1]) =>
  withApiHandler(request, handler, { organisationId, permission: PERMISSIONS["advertisingGoogleAds.draft"] });

export const withAdvertisingGoogleAdsValidate = (request: NextRequest, organisationId: string, handler: Parameters<typeof withApiHandler>[1]) =>
  withApiHandler(request, handler, { organisationId, permission: PERMISSIONS["advertisingGoogleAds.validate"] });

export const withAdvertisingGoogleAdsLaunch = (request: NextRequest, organisationId: string, handler: Parameters<typeof withApiHandler>[1]) =>
  withApiHandler(request, handler, { organisationId, permission: PERMISSIONS["advertisingGoogleAds.launch"] });

export const withAdvertisingGoogleAdsManage = (request: NextRequest, organisationId: string, handler: Parameters<typeof withApiHandler>[1]) =>
  withApiHandler(request, handler, { organisationId, permission: PERMISSIONS["advertisingGoogleAds.manage"] });
