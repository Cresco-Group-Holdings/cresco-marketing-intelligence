import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/response";
import { AppError } from "@/lib/errors";
import {
  requireOrganisationId,
  withAiCampaignGenerate,
  withCampaignsAnalytics,
  withCampaignsApprove,
  withCampaignsCancel,
  withCampaignsCreate,
  withCampaignsEdit,
  withCampaignsRead,
  withCampaignsSchedule,
  withCampaignsSend,
} from "@/lib/api/email-campaigns-handler";
import { crmAudienceSegmentService } from "@/server/services/crm-audience-segment-service";
import { emailCampaignService } from "@/server/services/email-campaign-service";

type Params = { params: Promise<{ brandId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { brandId } = await params;
  const organisationId = requireOrganisationId(request);
  const url = request.nextUrl;
  const campaignId = url.searchParams.get("campaignId");
  const view = url.searchParams.get("view");

  if (view === "segments") {
    return withCampaignsRead(request, organisationId, async ({ requestId, tenant }) => {
      const segments = await crmAudienceSegmentService.listSegments(brandId, organisationId, tenant!);
      return apiSuccess({ segments }, { requestId });
    });
  }

  if (campaignId && view === "analytics") {
    return withCampaignsAnalytics(request, organisationId, async ({ requestId, tenant }) => {
      const analytics = await emailCampaignService.getAnalytics(campaignId, brandId, organisationId, tenant!);
      return apiSuccess({ analytics }, { requestId });
    });
  }

  if (campaignId) {
    return withCampaignsRead(request, organisationId, async ({ requestId, tenant }) => {
      const campaign = await emailCampaignService.getCampaign(campaignId, brandId, organisationId, tenant!);
      return apiSuccess({ campaign }, { requestId });
    });
  }

  return withCampaignsRead(request, organisationId, async ({ requestId, tenant }) => {
    const campaigns = await emailCampaignService.listCampaigns(brandId, organisationId, tenant!);
    return apiSuccess({ campaigns }, { requestId });
  });
}

export async function POST(request: NextRequest, { params }: Params) {
  const { brandId } = await params;
  const organisationId = requireOrganisationId(request);
  const body = await request.json();

  switch (body.action) {
    case "createCampaign":
      return withCampaignsCreate(request, organisationId, async ({ requestId, tenant }) => {
        const campaign = await emailCampaignService.createCampaign(brandId, organisationId, body, tenant!);
        return apiSuccess({ campaign }, { requestId });
      });

    case "createSegment":
      return withCampaignsEdit(request, organisationId, async ({ requestId, tenant }) => {
        const segment = await crmAudienceSegmentService.createSegment(brandId, organisationId, body, tenant!);
        return apiSuccess({ segment }, { requestId });
      });

    case "approveSegment":
      return withCampaignsApprove(request, organisationId, async ({ requestId, tenant }) => {
        if (!body.segmentId) throw new AppError("VALIDATION_ERROR", "segmentId is required.");
        const segment = await crmAudienceSegmentService.approveSegment(body.segmentId, brandId, organisationId, tenant!);
        return apiSuccess({ segment }, { requestId });
      });

    case "setAudience":
      return withCampaignsEdit(request, organisationId, async ({ requestId, tenant }) => {
        if (!body.campaignId) throw new AppError("VALIDATION_ERROR", "campaignId is required.");
        const result = await emailCampaignService.setAudience(body.campaignId, brandId, organisationId, body, tenant!);
        return apiSuccess(result, { requestId });
      });

    case "setContent":
      return withCampaignsEdit(request, organisationId, async ({ requestId, tenant }) => {
        if (!body.campaignId) throw new AppError("VALIDATION_ERROR", "campaignId is required.");
        const content = await emailCampaignService.setContent(body.campaignId, brandId, organisationId, body, tenant!);
        return apiSuccess({ content }, { requestId });
      });

    case "runReadinessChecks":
      return withCampaignsEdit(request, organisationId, async ({ requestId, tenant }) => {
        if (!body.campaignId) throw new AppError("VALIDATION_ERROR", "campaignId is required.");
        const result = await emailCampaignService.runReadinessChecks(body.campaignId, brandId, organisationId, tenant!);
        return apiSuccess(result, { requestId });
      });

    case "grantApproval":
      return withCampaignsApprove(request, organisationId, async ({ requestId, tenant }) => {
        if (!body.campaignId) throw new AppError("VALIDATION_ERROR", "campaignId is required.");
        const approval = await emailCampaignService.grantApproval(body.campaignId, brandId, organisationId, body, tenant!);
        return apiSuccess({ approval }, { requestId });
      });

    case "setSchedule":
      return withCampaignsSchedule(request, organisationId, async ({ requestId, tenant }) => {
        if (!body.campaignId) throw new AppError("VALIDATION_ERROR", "campaignId is required.");
        const schedule = await emailCampaignService.setSchedule(body.campaignId, brandId, organisationId, body, tenant!);
        return apiSuccess({ schedule }, { requestId });
      });

    case "createSnapshot":
      return withCampaignsEdit(request, organisationId, async ({ requestId, tenant }) => {
        if (!body.campaignId) throw new AppError("VALIDATION_ERROR", "campaignId is required.");
        const result = await emailCampaignService.createRecipientSnapshot(body.campaignId, brandId, organisationId, body.members ?? [], tenant!);
        return apiSuccess(result, { requestId });
      });

    case "launchCampaign":
      return withCampaignsSend(request, organisationId, async ({ requestId, tenant }) => {
        if (!body.campaignId) throw new AppError("VALIDATION_ERROR", "campaignId is required.");
        const result = await emailCampaignService.launchCampaign(body.campaignId, brandId, organisationId, tenant!);
        return apiSuccess(result, { requestId });
      });

    case "cancelCampaign":
      return withCampaignsCancel(request, organisationId, async ({ requestId, tenant }) => {
        if (!body.campaignId) throw new AppError("VALIDATION_ERROR", "campaignId is required.");
        const campaign = await emailCampaignService.cancelCampaign(body.campaignId, brandId, organisationId, tenant!);
        return apiSuccess({ campaign }, { requestId });
      });

    case "emergencyStop":
      return withCampaignsCancel(request, organisationId, async ({ requestId, tenant }) => {
        if (!body.campaignId) throw new AppError("VALIDATION_ERROR", "campaignId is required.");
        const campaign = await emailCampaignService.emergencyStop(body.campaignId, brandId, organisationId, tenant!);
        return apiSuccess({ campaign }, { requestId });
      });

    case "generateAiDraft":
      return withAiCampaignGenerate(request, organisationId, async ({ requestId, tenant }) => {
        if (!body.campaignId) throw new AppError("VALIDATION_ERROR", "campaignId is required.");
        const draft = await emailCampaignService.generateAiDraft(body.campaignId, brandId, organisationId, body, tenant!);
        return apiSuccess({ draft }, { requestId });
      });

    case "createExperiment":
      return withCampaignsEdit(request, organisationId, async ({ requestId, tenant }) => {
        if (!body.campaignId) throw new AppError("VALIDATION_ERROR", "campaignId is required.");
        const experiment = await emailCampaignService.createExperiment(body.campaignId, brandId, organisationId, body, tenant!);
        return apiSuccess({ experiment }, { requestId });
      });

    case "evaluateExperiment":
      return withCampaignsAnalytics(request, organisationId, async ({ requestId, tenant }) => {
        if (!body.experimentId) throw new AppError("VALIDATION_ERROR", "experimentId is required.");
        const experiment = await emailCampaignService.evaluateExperiment(body.experimentId, brandId, organisationId, tenant!);
        return apiSuccess({ experiment }, { requestId });
      });

    default:
      throw new AppError("VALIDATION_ERROR", `Unknown action: ${body.action}`);
  }
}
