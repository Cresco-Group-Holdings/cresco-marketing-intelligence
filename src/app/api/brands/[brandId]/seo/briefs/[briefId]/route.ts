import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/response";
import { parseBody } from "@/lib/api/handler";
import {
  requireOrganisationId,
  withBriefsApprove,
  withBriefsGenerate,
  withBriefsManage,
  withBriefsRead,
} from "@/lib/api/briefs-handler";
import { briefApprovalSchema, briefCommentSchema, updateBriefSchema } from "@/lib/validation/briefs";
import { seoBriefApprovalService } from "@/server/services/seo-brief-approval-service";
import { seoBriefAiService } from "@/server/services/seo-brief-ai-service";
import { seoContentBriefService } from "@/server/services/seo-content-brief-service";

type Params = { params: Promise<{ brandId: string; briefId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { brandId, briefId } = await params;
  const organisationId = requireOrganisationId(request);
  return withBriefsRead(request, organisationId, async ({ requestId, tenant }) =>
    apiSuccess({ brief: await seoContentBriefService.getById(briefId, brandId, organisationId, tenant!) }, { requestId }),
  );
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const { brandId, briefId } = await params;
  const organisationId = requireOrganisationId(request);
  const body = await request.json();
  return withBriefsManage(request, organisationId, async ({ requestId, tenant }) => {
    const input = parseBody(updateBriefSchema, body);
    const brief = await seoContentBriefService.update(briefId, brandId, organisationId, input, tenant!);
    return apiSuccess({ brief }, { requestId });
  });
}

export async function POST(request: NextRequest, { params }: Params) {
  const { brandId, briefId } = await params;
  const organisationId = requireOrganisationId(request);
  const action = request.nextUrl.searchParams.get("action");
  const body = await request.json().catch(() => ({}));

  if (action === "generate") {
    return withBriefsGenerate(request, organisationId, async ({ requestId, tenant }) =>
      apiSuccess(await seoBriefAiService.generateBrief(briefId, brandId, organisationId, tenant!), { requestId }),
    );
  }

  if (action === "submit-review") {
    return withBriefsManage(request, organisationId, async ({ requestId, tenant }) =>
      apiSuccess(
        { brief: await seoBriefApprovalService.submitForReview(briefId, brandId, organisationId, tenant!) },
        { requestId },
      ),
    );
  }

  if (action === "approve") {
    return withBriefsApprove(request, organisationId, async ({ requestId, tenant }) => {
      const input = parseBody(briefApprovalSchema, body);
      const brief = await seoBriefApprovalService.decide(briefId, brandId, organisationId, input, tenant!);
      return apiSuccess({ brief }, { requestId });
    });
  }

  if (action === "comment") {
    return withBriefsManage(request, organisationId, async ({ requestId, tenant }) => {
      const input = parseBody(briefCommentSchema, body);
      const comment = await seoBriefApprovalService.addComment(briefId, brandId, organisationId, input, tenant!);
      return apiSuccess({ comment }, { requestId });
    });
  }

  return withBriefsRead(request, organisationId, async ({ requestId }) =>
    apiSuccess({ error: "Unknown action" }, { requestId }),
  );
}
