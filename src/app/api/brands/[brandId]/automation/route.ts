import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/response";
import { AppError } from "@/lib/errors";
import {
  requireOrganisationId,
  withAutomationActivate,
  withAutomationAnalytics,
  withAutomationApprove,
  withAutomationCreate,
  withAutomationEdit,
  withAutomationEnroll,
  withAutomationPause,
  withAutomationRead,
  withAutomationTemplates,
} from "@/lib/api/automation-handler";
import { marketingAutomationEnrollmentService } from "@/server/services/marketing-automation-enrollment-service";
import { marketingAutomationService } from "@/server/services/marketing-automation-service";

type Params = { params: Promise<{ brandId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { brandId } = await params;
  const organisationId = requireOrganisationId(request);
  const url = request.nextUrl;
  const automationId = url.searchParams.get("automationId");
  const view = url.searchParams.get("view");

  if (view === "templates") {
    return withAutomationTemplates(request, organisationId, async ({ requestId }) => {
      const templates = marketingAutomationService.listTemplates();
      return apiSuccess({ templates }, { requestId });
    });
  }

  if (automationId && view === "analytics") {
    return withAutomationAnalytics(request, organisationId, async ({ requestId, tenant }) => {
      const analytics = await marketingAutomationService.getAnalytics(
        automationId,
        brandId,
        organisationId,
        tenant!,
      );
      return apiSuccess({ analytics }, { requestId });
    });
  }

  if (automationId && view === "enrollments") {
    return withAutomationRead(request, organisationId, async ({ requestId, tenant }) => {
      const status = url.searchParams.get("status") ?? undefined;
      const leadId = url.searchParams.get("leadId") ?? undefined;
      const enrollments = await marketingAutomationEnrollmentService.listEnrollments(
        automationId,
        brandId,
        organisationId,
        tenant!,
        { status, leadId },
      );
      return apiSuccess({ enrollments }, { requestId });
    });
  }

  if (automationId && view === "errors") {
    return withAutomationRead(request, organisationId, async ({ requestId, tenant }) => {
      const resolvedParam = url.searchParams.get("resolved");
      const resolved = resolvedParam === "true" ? true : resolvedParam === "false" ? false : undefined;
      const errors = await marketingAutomationService.listErrors(
        automationId,
        brandId,
        organisationId,
        tenant!,
        { resolved },
      );
      return apiSuccess({ errors }, { requestId });
    });
  }

  if (automationId) {
    return withAutomationRead(request, organisationId, async ({ requestId, tenant }) => {
      const automation = await marketingAutomationService.getAutomation(
        automationId,
        brandId,
        organisationId,
        tenant!,
      );
      return apiSuccess({ automation }, { requestId });
    });
  }

  return withAutomationRead(request, organisationId, async ({ requestId, tenant }) => {
    const automations = await marketingAutomationService.listAutomations(brandId, organisationId, tenant!);
    return apiSuccess({ automations }, { requestId });
  });
}

export async function POST(request: NextRequest, { params }: Params) {
  const { brandId } = await params;
  const organisationId = requireOrganisationId(request);
  const body = await request.json();

  switch (body.action) {
    case "createAutomation":
      return withAutomationCreate(request, organisationId, async ({ requestId, tenant }) => {
        const automation = await marketingAutomationService.createAutomation(
          brandId,
          organisationId,
          body,
          tenant!,
        );
        return apiSuccess({ automation }, { requestId });
      });

    case "updateAutomation":
      return withAutomationEdit(request, organisationId, async ({ requestId, tenant }) => {
        if (!body.automationId) throw new AppError("VALIDATION_ERROR", "automationId is required.");
        const automation = await marketingAutomationService.updateAutomation(
          body.automationId,
          brandId,
          organisationId,
          body,
          tenant!,
        );
        return apiSuccess({ automation }, { requestId });
      });

    case "saveGraph":
      return withAutomationEdit(request, organisationId, async ({ requestId, tenant }) => {
        if (!body.automationId) throw new AppError("VALIDATION_ERROR", "automationId is required.");
        const version = await marketingAutomationService.saveGraph(
          body.automationId,
          brandId,
          organisationId,
          body,
          tenant!,
        );
        return apiSuccess({ version }, { requestId });
      });

    case "submitForReview":
      return withAutomationEdit(request, organisationId, async ({ requestId, tenant }) => {
        if (!body.automationId) throw new AppError("VALIDATION_ERROR", "automationId is required.");
        const automation = await marketingAutomationService.submitForReview(
          body.automationId,
          brandId,
          organisationId,
          tenant!,
        );
        return apiSuccess({ automation }, { requestId });
      });

    case "approveVersion":
      return withAutomationApprove(request, organisationId, async ({ requestId, tenant }) => {
        if (!body.automationId) throw new AppError("VALIDATION_ERROR", "automationId is required.");
        const automation = await marketingAutomationService.approveVersion(
          body.automationId,
          brandId,
          organisationId,
          body,
          tenant!,
        );
        return apiSuccess({ automation }, { requestId });
      });

    case "activateVersion":
      return withAutomationActivate(request, organisationId, async ({ requestId, tenant }) => {
        if (!body.automationId) throw new AppError("VALIDATION_ERROR", "automationId is required.");
        const automation = await marketingAutomationService.activateVersion(
          body.automationId,
          brandId,
          organisationId,
          body,
          tenant!,
        );
        return apiSuccess({ automation }, { requestId });
      });

    case "pauseAutomation":
      return withAutomationPause(request, organisationId, async ({ requestId, tenant }) => {
        if (!body.automationId) throw new AppError("VALIDATION_ERROR", "automationId is required.");
        const automation = await marketingAutomationService.pauseAutomation(
          body.automationId,
          brandId,
          organisationId,
          tenant!,
        );
        return apiSuccess({ automation }, { requestId });
      });

    case "stopAutomation":
      return withAutomationPause(request, organisationId, async ({ requestId, tenant }) => {
        if (!body.automationId) throw new AppError("VALIDATION_ERROR", "automationId is required.");
        const automation = await marketingAutomationService.stopAutomation(
          body.automationId,
          brandId,
          organisationId,
          tenant!,
        );
        return apiSuccess({ automation }, { requestId });
      });

    case "globalStop":
      return withAutomationPause(request, organisationId, async ({ requestId, tenant }) => {
        const result = await marketingAutomationService.globalStop(brandId, organisationId, tenant!);
        return apiSuccess(result, { requestId });
      });

    case "createFromTemplate":
      return withAutomationTemplates(request, organisationId, async ({ requestId, tenant }) => {
        if (!body.templateKey) throw new AppError("VALIDATION_ERROR", "templateKey is required.");
        const automation = await marketingAutomationService.createFromTemplate(
          brandId,
          organisationId,
          body.templateKey,
          tenant!,
        );
        return apiSuccess({ automation }, { requestId });
      });

    case "enrollLead":
      return withAutomationEnroll(request, organisationId, async ({ requestId, tenant }) => {
        if (!body.automationId) throw new AppError("VALIDATION_ERROR", "automationId is required.");
        if (!body.leadId) throw new AppError("VALIDATION_ERROR", "leadId is required.");
        const enrollment = await marketingAutomationEnrollmentService.enrollLead(
          body.automationId,
          brandId,
          organisationId,
          body,
          tenant!,
        );
        return apiSuccess({ enrollment }, { requestId });
      });

    case "removeEnrollment":
      return withAutomationEnroll(request, organisationId, async ({ requestId, tenant }) => {
        if (!body.automationId) throw new AppError("VALIDATION_ERROR", "automationId is required.");
        if (!body.enrollmentId) throw new AppError("VALIDATION_ERROR", "enrollmentId is required.");
        const enrollment = await marketingAutomationEnrollmentService.removeEnrollment(
          body.enrollmentId,
          body.automationId,
          brandId,
          organisationId,
          tenant!,
        );
        return apiSuccess({ enrollment }, { requestId });
      });

    case "resolveError":
      return withAutomationEdit(request, organisationId, async ({ requestId, tenant }) => {
        if (!body.automationId) throw new AppError("VALIDATION_ERROR", "automationId is required.");
        if (!body.errorId) throw new AppError("VALIDATION_ERROR", "errorId is required.");
        const error = await marketingAutomationService.resolveError(
          body.errorId,
          body.automationId,
          brandId,
          organisationId,
          tenant!,
        );
        return apiSuccess({ error }, { requestId });
      });

    default:
      throw new AppError("VALIDATION_ERROR", `Unknown action: ${body.action}`);
  }
}
