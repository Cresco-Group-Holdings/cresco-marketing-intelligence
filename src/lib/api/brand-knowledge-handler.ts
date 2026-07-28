import { NextRequest } from "next/server";
import {
  apiSuccess,
  getOrganisationIdFromRequest,
  jsonBody,
  parseBody,
  withApiHandler,
} from "@/lib/api/handler";
import { AppError } from "@/lib/errors";
import { PERMISSIONS } from "@/lib/tenancy/permissions";

type BrandParams = { params: Promise<{ brandId: string }> };
type BrandResourceParams = { params: Promise<{ brandId: string; resourceId: string }> };

export function requireOrganisationId(request: NextRequest): string {
  const organisationId = getOrganisationIdFromRequest(request);
  if (!organisationId) {
    throw new AppError("TENANT_CONTEXT_REQUIRED", "Organisation context is required.");
  }
  return organisationId;
}

export async function withBrandKnowledgeRead(
  request: NextRequest,
  organisationId: string,
  handler: Parameters<typeof withApiHandler>[1],
) {
  return withApiHandler(
    request,
    handler,
    { organisationId, permission: PERMISSIONS["brandKnowledge.read"] },
  );
}

export async function withBrandKnowledgeWrite(
  request: NextRequest,
  organisationId: string,
  handler: Parameters<typeof withApiHandler>[1],
) {
  return withApiHandler(
    request,
    handler,
    { organisationId, permission: PERMISSIONS["brandKnowledge.update"] },
  );
}

export type { BrandParams, BrandResourceParams };
export { apiSuccess, jsonBody, parseBody };
