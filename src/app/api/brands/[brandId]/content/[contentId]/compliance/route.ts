import { NextRequest } from "next/server";
import { apiSuccess, jsonBody, parseBody } from "@/lib/api/handler";
import {
  withComplianceOverride,
  withComplianceRead,
  withComplianceWrite,
} from "@/lib/api/compliance-handler";
import {
  complianceDismissSchema,
  complianceEvaluateSchema,
  complianceOverrideSchema,
} from "@/lib/validation/compliance";
import { complianceAgentService } from "@/server/services/compliance-agent-service";
import { complianceReviewSuggestionService } from "@/server/services/compliance-review-suggestion-service";

type Params = { params: Promise<{ brandId: string; contentId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { brandId, contentId } = await params;
  return withComplianceRead(request, async ({ requestId, tenant }) =>
    apiSuccess(
      {
        evaluation: await complianceAgentService.getLatestEvaluation(
          tenant!.organisationId,
          brandId,
          contentId,
        ),
      },
      { requestId },
    ),
  );
}

export async function POST(request: NextRequest, { params }: Params) {
  const { brandId, contentId } = await params;
  const action = request.nextUrl.searchParams.get("action");

  if (action === "suggest-review") {
    return withComplianceWrite(request, async ({ requestId, tenant }) =>
      apiSuccess(
        await complianceReviewSuggestionService.suggest(
          brandId,
          tenant!.organisationId,
          contentId,
          tenant!,
        ),
        { requestId },
      ),
    );
  }

  if (action === "override") {
    const body = parseBody(complianceOverrideSchema, await jsonBody(request));
    return withComplianceOverride(request, async ({ requestId, tenant }) =>
      apiSuccess(
        {
          override: await complianceAgentService.overrideFinding(
            brandId,
            tenant!.organisationId,
            contentId,
            body,
            tenant!,
            requestId,
          ),
        },
        { requestId },
      ),
    );
  }

  if (action === "dismiss") {
    const body = parseBody(complianceDismissSchema, await jsonBody(request));
    return withComplianceWrite(request, async ({ requestId, tenant }) =>
      apiSuccess(
        await complianceAgentService.dismissFinding(
          brandId,
          tenant!.organisationId,
          contentId,
          body,
          tenant!,
          requestId,
        ),
        { requestId },
      ),
    );
  }

  const body = parseBody(
    complianceEvaluateSchema,
    await jsonBody(request).catch(() => ({})),
  );
  return withComplianceWrite(request, async ({ requestId, tenant }) =>
    apiSuccess(
      {
        evaluation: await complianceAgentService.evaluate(
          brandId,
          tenant!.organisationId,
          contentId,
          tenant!,
          { contentVariantId: body.contentVariantId, requestId },
        ),
      },
      { requestId },
    ),
  );
}
