import { NextRequest } from "next/server";
import {
  apiSuccess,
  getOrganisationIdFromRequest,
  withApiHandler,
} from "@/lib/api/handler";
import { AppError } from "@/lib/errors";
import { PERMISSIONS } from "@/lib/tenancy/permissions";

type BrandParams = { params: Promise<{ brandId: string }> };
type BrandKbParams = { params: Promise<{ brandId: string; knowledgeBaseId: string }> };
type BrandKbEntryParams = {
  params: Promise<{ brandId: string; knowledgeBaseId: string; entryId: string }>;
};
type BrandKbDocParams = {
  params: Promise<{ brandId: string; knowledgeBaseId: string; documentId: string }>;
};
type BrandKbRelationshipParams = {
  params: Promise<{ brandId: string; knowledgeBaseId: string; entryId: string; relationshipId: string }>;
};

export function requireOrganisationId(request: NextRequest): string {
  const organisationId = getOrganisationIdFromRequest(request);
  if (!organisationId) {
    throw new AppError("TENANT_CONTEXT_REQUIRED", "Organisation context is required.");
  }
  return organisationId;
}

export async function withKnowledgeBaseRead(
  request: NextRequest,
  organisationId: string,
  handler: Parameters<typeof withApiHandler>[1],
) {
  return withApiHandler(request, handler, {
    organisationId,
    permission: PERMISSIONS["brandKnowledge.read"],
  });
}

export async function withKnowledgeBaseWrite(
  request: NextRequest,
  organisationId: string,
  handler: Parameters<typeof withApiHandler>[1],
) {
  return withApiHandler(request, handler, {
    organisationId,
    permission: PERMISSIONS["brandKnowledge.update"],
  });
}

export type {
  BrandParams,
  BrandKbParams,
  BrandKbEntryParams,
  BrandKbDocParams,
  BrandKbRelationshipParams,
};

export { apiSuccess } from "@/lib/api/handler";
export { jsonBody, parseBody } from "@/lib/api/handler";
