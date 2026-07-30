import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/response";
import { parseBody } from "@/lib/api/handler";
import { AppError } from "@/lib/errors";
import {
  requireOrganisationId,
  withAdvertisingAudiencesApprove,
  withAdvertisingAudiencesEdit,
  withAdvertisingAudiencesRead,
  withAdvertisingAudiencesReview,
} from "@/lib/api/advertising-audiences-handler";
import {
  addExclusionSchema,
  addRuleSchema,
  consentPolicySchema,
} from "@/lib/validation/advertising-audiences";
import { advertisingAudienceAiService } from "@/server/services/advertising-audience-ai-service";
import { advertisingAudienceEligibilityService } from "@/server/services/advertising-audience-eligibility-service";
import { advertisingAudienceService } from "@/server/services/advertising-audience-service";

type Params = { params: Promise<{ brandId: string; audienceId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { brandId, audienceId } = await params;
  const organisationId = requireOrganisationId(request);
  return withAdvertisingAudiencesRead(request, organisationId, async ({ requestId, tenant }) =>
    apiSuccess(
      { audience: await advertisingAudienceService.getById(audienceId, brandId, organisationId, tenant!) },
      { requestId },
    ),
  );
}

export async function POST(request: NextRequest, { params }: Params) {
  const { brandId, audienceId } = await params;
  const organisationId = requireOrganisationId(request);
  const body = await request.json();
  const action = body.action as string;

  if (action === "generate-plan") {
    return withAdvertisingAudiencesEdit(request, organisationId, async ({ requestId, tenant }) => {
      const result = await advertisingAudienceAiService.generatePlan(audienceId, brandId, organisationId, tenant!);
      return apiSuccess(result, { requestId });
    });
  }

  if (action === "add-rule") {
    return withAdvertisingAudiencesEdit(request, organisationId, async ({ requestId, tenant }) => {
      const input = parseBody(addRuleSchema, body);
      const rule = await advertisingAudienceService.addRule(audienceId, brandId, organisationId, input, tenant!);
      return apiSuccess({ rule }, { requestId });
    });
  }

  if (action === "add-exclusion") {
    return withAdvertisingAudiencesEdit(request, organisationId, async ({ requestId, tenant }) => {
      const input = parseBody(addExclusionSchema, body);
      const exclusion = await advertisingAudienceService.addExclusion(audienceId, brandId, organisationId, input, tenant!);
      return apiSuccess({ exclusion }, { requestId });
    });
  }

  if (action === "update-consent") {
    return withAdvertisingAudiencesEdit(request, organisationId, async ({ requestId, tenant }) => {
      const input = parseBody(consentPolicySchema, body);
      const policy = await advertisingAudienceService.updateConsentPolicy(audienceId, brandId, organisationId, input, tenant!);
      return apiSuccess({ policy }, { requestId });
    });
  }

  if (action === "eligibility") {
    return withAdvertisingAudiencesRead(request, organisationId, async ({ requestId, tenant }) => {
      const result = await advertisingAudienceEligibilityService.runChecks(audienceId, brandId, organisationId, tenant!);
      return apiSuccess(result, { requestId });
    });
  }

  if (action === "submit-review") {
    return withAdvertisingAudiencesReview(request, organisationId, async ({ requestId, tenant }) => {
      const audience = await advertisingAudienceService.updateStatus(audienceId, brandId, organisationId, "IN_REVIEW", tenant!);
      return apiSuccess({ audience }, { requestId });
    });
  }

  if (action === "approve") {
    return withAdvertisingAudiencesApprove(request, organisationId, async ({ requestId, tenant }) => {
      const audience = await advertisingAudienceService.updateStatus(audienceId, brandId, organisationId, "APPROVED", tenant!);
      return apiSuccess({ audience }, { requestId });
    });
  }

  if (action === "create-version") {
    return withAdvertisingAudiencesEdit(request, organisationId, async ({ requestId, tenant }) => {
      const version = await advertisingAudienceService.createVersion(audienceId, brandId, organisationId, tenant!, body.changeNote);
      return apiSuccess({ version }, { requestId });
    });
  }

  throw new AppError("VALIDATION_ERROR", `Unknown action: ${action}`);
}
