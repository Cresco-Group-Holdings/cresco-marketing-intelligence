import { NextRequest } from "next/server";
import { apiSuccess, jsonBody, parseBody } from "@/lib/api/handler";
import {
  requireOrganisationId,
  withContentEdit,
} from "@/lib/api/content-handler";
import { AppError } from "@/lib/errors";
import { contentRevisionRestoreSchema } from "@/lib/validation/content";
import { contentService } from "@/server/services/content-service";

type Params = {
  params: Promise<{ brandId: string; contentId: string; revisionNumber: string }>;
};

export async function POST(request: NextRequest, { params }: Params) {
  const { brandId, contentId, revisionNumber: revisionNumberParam } = await params;
  const organisationId = requireOrganisationId(request);
  const revisionNumber = Number(revisionNumberParam);
  if (!Number.isInteger(revisionNumber) || revisionNumber < 1) {
    throw new AppError("VALIDATION_ERROR", "Invalid revision number.");
  }
  const body = parseBody(contentRevisionRestoreSchema, await jsonBody(request));

  return withContentEdit(request, organisationId, async ({ requestId, tenant }) => {
    const item = await contentService.restoreRevision(
      brandId,
      organisationId,
      contentId,
      revisionNumber,
      tenant!,
      body.changeNote,
      requestId,
    );
    return apiSuccess({ item }, { requestId });
  });
}
