import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/response";
import { AppError } from "@/lib/errors";
import {
  requireOrganisationId,
  withEmailApproveTemplates,
  withEmailManageDomains,
  withEmailManageProviders,
  withEmailManageSenders,
  withEmailManageSuppressions,
  withEmailManageTemplates,
  withEmailRead,
  withEmailSendMarketing,
  withEmailSendTest,
  withEmailSendTransactional,
  withEmailViewDeliverability,
} from "@/lib/api/email-handler";
import { isMarketingCategory } from "@/lib/email/suppression";
import { emailDeliverabilityService, emailWebhookService } from "@/server/services/email-webhook-service";
import { emailInfrastructureService } from "@/server/services/email-infrastructure-service";
import { emailMessageService } from "@/server/services/email-message-service";
import { emailSuppressionService } from "@/server/services/email-suppression-service";
import { emailTemplateService } from "@/server/services/email-template-service";

type Params = { params: Promise<{ brandId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { brandId } = await params;
  const organisationId = requireOrganisationId(request);
  const view = request.nextUrl.searchParams.get("view");

  if (view === "providers") {
    return withEmailRead(request, organisationId, async ({ requestId, tenant }) => {
      const providers = await emailInfrastructureService.listProviders(brandId, organisationId, tenant!);
      return apiSuccess({ providers }, { requestId });
    });
  }
  if (view === "domains") {
    return withEmailRead(request, organisationId, async ({ requestId, tenant }) => {
      const domains = await emailInfrastructureService.listDomains(brandId, organisationId, tenant!);
      return apiSuccess({ domains }, { requestId });
    });
  }
  if (view === "senders") {
    return withEmailRead(request, organisationId, async ({ requestId, tenant }) => {
      const senders = await emailInfrastructureService.listSenders(brandId, organisationId, tenant!);
      return apiSuccess({ senders }, { requestId });
    });
  }
  if (view === "templates") {
    return withEmailRead(request, organisationId, async ({ requestId, tenant }) => {
      const templates = await emailTemplateService.listTemplates(brandId, organisationId, tenant!);
      return apiSuccess({ templates }, { requestId });
    });
  }
  if (view === "messages") {
    return withEmailRead(request, organisationId, async ({ requestId, tenant }) => {
      const messages = await emailMessageService.listMessages(brandId, organisationId, tenant!);
      return apiSuccess({ messages }, { requestId });
    });
  }
  if (view === "suppressions") {
    return withEmailRead(request, organisationId, async ({ requestId, tenant }) => {
      const suppressions = await emailSuppressionService.listSuppressions(brandId, organisationId, tenant!);
      return apiSuccess({ suppressions }, { requestId });
    });
  }
  if (view === "deliverability") {
    return withEmailViewDeliverability(request, organisationId, async ({ requestId, tenant }) => {
      const result = await emailDeliverabilityService.getSnapshot(brandId, organisationId, tenant!);
      const snapshots = await emailDeliverabilityService.listSnapshots(brandId, organisationId, tenant!);
      return apiSuccess({ ...result, snapshots }, { requestId });
    });
  }
  if (view === "trackingPolicy") {
    return withEmailRead(request, organisationId, async ({ requestId, tenant }) => {
      const policy = await emailInfrastructureService.getTrackingPolicy(brandId, organisationId, tenant!);
      return apiSuccess({ policy }, { requestId });
    });
  }

  return withEmailRead(request, organisationId, async ({ requestId, tenant }) => {
    const [providers, domains, senders, templates, messages] = await Promise.all([
      emailInfrastructureService.listProviders(brandId, organisationId, tenant!),
      emailInfrastructureService.listDomains(brandId, organisationId, tenant!),
      emailInfrastructureService.listSenders(brandId, organisationId, tenant!),
      emailTemplateService.listTemplates(brandId, organisationId, tenant!),
      emailMessageService.listMessages(brandId, organisationId, tenant!),
    ]);
    return apiSuccess({ providers, domains, senders, templates, messages }, { requestId });
  });
}

export async function POST(request: NextRequest, { params }: Params) {
  const { brandId } = await params;
  const organisationId = requireOrganisationId(request);
  const body = await request.json();

  switch (body.action) {
    case "createProvider":
      return withEmailManageProviders(request, organisationId, async ({ requestId, tenant }) => {
        const provider = await emailInfrastructureService.createProvider(brandId, organisationId, body, tenant!);
        return apiSuccess({ provider }, { requestId });
      });

    case "addDomain":
      return withEmailManageDomains(request, organisationId, async ({ requestId, tenant }) => {
        const domain = await emailInfrastructureService.addDomain(brandId, organisationId, body, tenant!);
        return apiSuccess({ domain }, { requestId });
      });

    case "checkDomain":
      return withEmailManageDomains(request, organisationId, async ({ requestId, tenant }) => {
        if (!body.domainId) throw new AppError("VALIDATION_ERROR", "domainId is required.");
        const domain = await emailInfrastructureService.checkDomain(body.domainId, brandId, organisationId, tenant!);
        return apiSuccess({ domain }, { requestId });
      });

    case "createSender":
      return withEmailManageSenders(request, organisationId, async ({ requestId, tenant }) => {
        const sender = await emailInfrastructureService.createSender(brandId, organisationId, body, tenant!);
        return apiSuccess({ sender }, { requestId });
      });

    case "createTemplate":
      return withEmailManageTemplates(request, organisationId, async ({ requestId, tenant }) => {
        const result = await emailTemplateService.createTemplate(brandId, organisationId, body, tenant!);
        return apiSuccess(result, { requestId });
      });

    case "approveTemplate":
      return withEmailApproveTemplates(request, organisationId, async ({ requestId, tenant }) => {
        if (!body.versionId) throw new AppError("VALIDATION_ERROR", "versionId is required.");
        const version = await emailTemplateService.approveVersion(body.versionId, brandId, organisationId, tenant!);
        return apiSuccess({ version }, { requestId });
      });

    case "previewTemplate":
      return withEmailRead(request, organisationId, async ({ requestId, tenant }) => {
        if (!body.versionId) throw new AppError("VALIDATION_ERROR", "versionId is required.");
        const preview = await emailTemplateService.previewVersion(body.versionId, brandId, organisationId, body.variables ?? {}, tenant!);
        return apiSuccess({ preview }, { requestId });
      });

    case "queueMessage": {
      const isMarketing = isMarketingCategory(body.category);
      const isTest = body.isTest === true;
      const handler = isTest
        ? withEmailSendTest
        : isMarketing
          ? withEmailSendMarketing
          : withEmailSendTransactional;
      return handler(request, organisationId, async ({ requestId, tenant }) => {
        const message = await emailMessageService.queueMessage(brandId, organisationId, body, tenant!);
        return apiSuccess({ message }, { requestId });
      });
    }

    case "dispatchMessage":
      return withEmailSendTransactional(request, organisationId, async ({ requestId, tenant }) => {
        if (!body.messageId) throw new AppError("VALIDATION_ERROR", "messageId is required.");
        const message = await emailMessageService.dispatchMessage(body.messageId, brandId, organisationId, tenant!);
        return apiSuccess({ message }, { requestId });
      });

    case "cancelMessage":
      return withEmailSendTransactional(request, organisationId, async ({ requestId, tenant }) => {
        if (!body.messageId) throw new AppError("VALIDATION_ERROR", "messageId is required.");
        const message = await emailMessageService.cancelMessage(body.messageId, brandId, organisationId, tenant!);
        return apiSuccess({ message }, { requestId });
      });

    case "addSuppression":
      return withEmailManageSuppressions(request, organisationId, async ({ requestId, tenant }) => {
        const suppression = await emailSuppressionService.addSuppression(brandId, organisationId, body, tenant!);
        return apiSuccess({ suppression }, { requestId });
      });

    case "removeSuppression":
      return withEmailManageSuppressions(request, organisationId, async ({ requestId, tenant }) => {
        if (!body.suppressionId) throw new AppError("VALIDATION_ERROR", "suppressionId is required.");
        const result = await emailSuppressionService.removeSuppression(body.suppressionId, brandId, organisationId, tenant!);
        return apiSuccess(result, { requestId });
      });

    case "upsertTrackingPolicy":
      return withEmailManageProviders(request, organisationId, async ({ requestId, tenant }) => {
        const policy = await emailInfrastructureService.upsertTrackingPolicy(brandId, organisationId, body, tenant!);
        return apiSuccess({ policy }, { requestId });
      });

    case "processWebhook":
      return withEmailManageProviders(request, organisationId, async ({ requestId }) => {
        const result = await emailWebhookService.processWebhook(
          body.providerConnectionId,
          organisationId,
          body.payload,
          body.signature,
          body.secret,
        );
        return apiSuccess({ result }, { requestId });
      });

    default:
      throw new AppError("VALIDATION_ERROR", `Unknown action: ${body.action}`);
  }
}
