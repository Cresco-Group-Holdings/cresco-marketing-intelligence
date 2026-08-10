import { NextRequest } from "next/server";
import {
  apiSuccess,
  getOrganisationIdFromRequest,
  withApiHandler,
} from "@/lib/api/handler";
import { AppError } from "@/lib/errors";
import { PERMISSIONS } from "@/lib/tenancy/permissions";

type BrandParams = { params: Promise<{ brandId: string }> };
type BrandAssetParams = { params: Promise<{ brandId: string; assetId: string }> };

export function requireOrganisationId(request: NextRequest): string {
  const organisationId = getOrganisationIdFromRequest(request);
  if (!organisationId) {
    throw new AppError("TENANT_CONTEXT_REQUIRED", "Organisation context is required.");
  }
  return organisationId;
}

export async function withDigitalAssetsRead(
  request: NextRequest,
  organisationId: string,
  handler: Parameters<typeof withApiHandler>[1],
) {
  return withApiHandler(request, handler, {
    organisationId,
    permission: PERMISSIONS["digitalAssets.read"],
  });
}

export async function withDigitalAssetsWrite(
  request: NextRequest,
  organisationId: string,
  handler: Parameters<typeof withApiHandler>[1],
) {
  return withApiHandler(request, handler, {
    organisationId,
    permission: PERMISSIONS["digitalAssets.update"],
  });
}

export type { BrandParams, BrandAssetParams };
export { apiSuccess } from "@/lib/api/handler";
export { jsonBody, parseBody } from "@/lib/api/handler";
