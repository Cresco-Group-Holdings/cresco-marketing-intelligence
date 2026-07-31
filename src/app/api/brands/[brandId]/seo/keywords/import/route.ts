import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/response";
import { parseBody } from "@/lib/api/handler";
import {
  requireOrganisationId,
  withKeywordsImport,
  withKeywordsManage,
} from "@/lib/api/keywords-handler";
import { createGroupSchema, keywordImportSchema } from "@/lib/validation/keywords";
import { prisma } from "@/lib/database/prisma";
import { seoKeywordImportService } from "@/server/services/seo-keyword-import-service";
import { brandService } from "@/server/services/workspace-service";

type Params = { params: Promise<{ brandId: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const { brandId } = await params;
  const organisationId = requireOrganisationId(request);
  const body = await request.json();
  return withKeywordsImport(request, organisationId, async ({ requestId, tenant }) => {
    const input = parseBody(keywordImportSchema, body);
    const job = await seoKeywordImportService.createPreview(
      brandId,
      organisationId,
      input,
      tenant!,
    );
    return apiSuccess({ import: job }, { requestId });
  });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const { brandId } = await params;
  const organisationId = requireOrganisationId(request);
  const importId = request.nextUrl.searchParams.get("importId");
  if (!importId) {
    return apiSuccess({ error: "importId required" }, { requestId: randomUUID() });
  }
  return withKeywordsImport(request, organisationId, async ({ requestId, tenant }) => {
    const job = await seoKeywordImportService.confirm(importId, brandId, organisationId, tenant!);
    return apiSuccess({ import: job }, { requestId });
  });
}
