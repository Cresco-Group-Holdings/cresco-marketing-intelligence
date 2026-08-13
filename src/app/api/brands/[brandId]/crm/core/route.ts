import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/response";
import { AppError } from "@/lib/errors";
import {
  requireOrganisationId,
  withCrmArchive,
  withCrmCreate,
  withCrmEdit,
  withCrmExport,
  withCrmManageConsent,
  withCrmRead,
} from "@/lib/api/crm-handler";
import {
  archiveLeadSchema,
  consentRecordSchema,
  duplicateDetectionSchema,
  manualScoreSchema,
  qualificationAssessmentSchema,
  transitionLeadSchema,
} from "@/lib/validation/crm-lead-core";
import { crmLeadCoreService } from "@/server/services/crm-lead-core-service";

type Params = { params: Promise<{ brandId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { brandId } = await params;
  const organisationId = requireOrganisationId(request);
  const leadId = request.nextUrl.searchParams.get("leadId");
  const view = request.nextUrl.searchParams.get("view");
  const status = request.nextUrl.searchParams.get("status") ?? undefined;

  return withCrmRead(request, organisationId, async ({ requestId, tenant }) => {
    if (leadId) {
      const lead = await crmLeadCoreService.getLeadCore(leadId, brandId, organisationId, tenant!);
      return apiSuccess({ lead }, { requestId });
    }

    if (view === "workflow") {
      const leads = await crmLeadCoreService.listWorkflowLeads(brandId, organisationId, tenant!, status);
      return apiSuccess({ leads }, { requestId });
    }

    throw new AppError("VALIDATION_ERROR", "Specify leadId or view=workflow.");
  });
}

export async function POST(request: NextRequest, { params }: Params) {
  const { brandId } = await params;
  const organisationId = requireOrganisationId(request);
  const body = await request.json();

  switch (body.action) {
    case "transitionLead": {
      const input = transitionLeadSchema.parse(body);
      return withCrmEdit(request, organisationId, async ({ requestId, tenant }) => {
        const lead = await crmLeadCoreService.transitionLead(
          input.leadId,
          brandId,
          organisationId,
          input.status,
          input.reason,
          tenant!,
        );
        return apiSuccess({ lead }, { requestId });
      });
    }

    case "recordQualification": {
      const input = qualificationAssessmentSchema.parse(body);
      return withCrmEdit(request, organisationId, async ({ requestId, tenant }) => {
        const assessment = await crmLeadCoreService.recordQualificationAssessment(
          brandId,
          organisationId,
          input,
          tenant!,
        );
        return apiSuccess({ assessment }, { requestId });
      });
    }

    case "recordConsent": {
      const input = consentRecordSchema.parse(body);
      return withCrmManageConsent(request, organisationId, async ({ requestId, tenant }) => {
        const consent = await crmLeadCoreService.recordConsent(brandId, organisationId, input, tenant!);
        return apiSuccess({ consent }, { requestId });
      });
    }

    case "recordManualScore": {
      const input = manualScoreSchema.parse(body);
      return withCrmEdit(request, organisationId, async ({ requestId, tenant }) => {
        const score = await crmLeadCoreService.recordManualScore(brandId, organisationId, input, tenant!);
        return apiSuccess({ score }, { requestId });
      });
    }

    case "detectDuplicates": {
      const input = duplicateDetectionSchema.parse(body);
      return withCrmCreate(request, organisationId, async ({ requestId, tenant }) => {
        const result = await crmLeadCoreService.detectDuplicates(brandId, organisationId, input, tenant!);
        return apiSuccess(result, { requestId });
      });
    }

    case "exportLead": {
      const leadId = body.leadId as string;
      const scope = (body.scope as "FULL" | "SUMMARY") ?? "FULL";
      if (!leadId) throw new AppError("VALIDATION_ERROR", "leadId is required.");
      return withCrmExport(request, organisationId, async ({ requestId, tenant }) => {
        const exportData = await crmLeadCoreService.exportLead(
          leadId,
          brandId,
          organisationId,
          scope,
          tenant!,
        );
        return apiSuccess(exportData, { requestId });
      });
    }

    case "archiveLead": {
      const input = archiveLeadSchema.parse(body);
      return withCrmArchive(request, organisationId, async ({ requestId, tenant }) => {
        const lead = await crmLeadCoreService.archiveLead(
          input.leadId,
          brandId,
          organisationId,
          input.reason,
          tenant!,
        );
        return apiSuccess({ lead }, { requestId });
      });
    }

    case "prepareAnonymisation": {
      const leadId = body.leadId as string;
      if (!leadId) throw new AppError("VALIDATION_ERROR", "leadId is required.");
      return withCrmArchive(request, organisationId, async ({ requestId, tenant }) => {
        const preview = await crmLeadCoreService.prepareAnonymisation(
          leadId,
          brandId,
          organisationId,
          tenant!,
        );
        return apiSuccess({ preview }, { requestId });
      });
    }

    default:
      throw new AppError("VALIDATION_ERROR", `Unknown action: ${body.action}`);
  }
}
