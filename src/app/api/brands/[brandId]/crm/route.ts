import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/api/response";
import { AppError } from "@/lib/errors";
import {
  requireOrganisationId,
  withCrmAssignOwner,
  withCrmCreate,
  withCrmEdit,
  withCrmManageCustomFields,
  withCrmManageDuplicates,
  withCrmMergeRecords,
  withCrmRead,
} from "@/lib/api/crm-handler";
import { crmService } from "@/server/services/crm-service";

type Params = { params: Promise<{ brandId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { brandId } = await params;
  const organisationId = requireOrganisationId(request);
  const url = request.nextUrl;
  const leadId = url.searchParams.get("leadId");
  const contactId = url.searchParams.get("contactId");
  const companyId = url.searchParams.get("companyId");
  const view = url.searchParams.get("view");

  return withCrmRead(request, organisationId, async ({ requestId, tenant }) => {
    if (leadId) {
      const lead = await crmService.getLead(leadId, brandId, organisationId, tenant!);
      return apiSuccess({ lead }, { requestId });
    }

    if (contactId) {
      const contact = await crmService.getContact(contactId, brandId, organisationId, tenant!);
      return apiSuccess({ contact }, { requestId });
    }

    if (companyId) {
      const company = await crmService.getCompany(companyId, brandId, organisationId, tenant!);
      return apiSuccess({ company }, { requestId });
    }

    if (view === "dashboard") {
      const dashboard = await crmService.getDashboard(brandId, organisationId, tenant!);
      return apiSuccess({ dashboard }, { requestId });
    }

    if (view === "contacts") {
      const contacts = await crmService.listContacts(brandId, organisationId, tenant!);
      return apiSuccess({ contacts }, { requestId });
    }

    if (view === "companies") {
      const companies = await crmService.listCompanies(brandId, organisationId, tenant!);
      return apiSuccess({ companies }, { requestId });
    }

    if (view === "duplicates") {
      const duplicates = await crmService.listDuplicateCandidates(brandId, organisationId, tenant!);
      return apiSuccess({ duplicates }, { requestId });
    }

    if (view === "customFields") {
      const fields = await crmService.listCustomFields(brandId, organisationId, tenant!);
      return apiSuccess({ fields }, { requestId });
    }

    const leads = await crmService.listLeads(brandId, organisationId, tenant!, {
      status: url.searchParams.get("status") ?? undefined,
      lifecycleStage: url.searchParams.get("lifecycleStage") ?? undefined,
      ownerUserId: url.searchParams.get("ownerUserId") ?? undefined,
    });

    return apiSuccess({ leads }, { requestId });
  });
}

export async function POST(request: NextRequest, { params }: Params) {
  const { brandId } = await params;
  const organisationId = requireOrganisationId(request);
  const body = await request.json();

  switch (body.action) {
    case "createLead":
      return withCrmCreate(request, organisationId, async ({ requestId, tenant }) => {
        const lead = await crmService.createLead(
          brandId,
          organisationId,
          {
            status: body.status,
            lifecycleStage: body.lifecycleStage,
            primaryProductInterest: body.primaryProductInterest,
            preferredLanguage: body.preferredLanguage,
            country: body.country,
            ownerUserId: body.ownerUserId,
            marketingLeadId: body.marketingLeadId,
            sourceType: body.sourceType ?? "MANUAL_ENTRY",
            person: {
              displayName: [body.firstName, body.lastName].filter(Boolean).join(" ") || undefined,
              contactMethods: [
                ...(body.email ? [{ methodType: "EMAIL", value: body.email, isPrimary: true }] : []),
                ...(body.phone ? [{ methodType: "PHONE", value: body.phone }] : []),
              ],
            },
          },
          tenant!,
        );
        return apiSuccess({ lead }, { requestId });
      });

    case "updateStatus":
      return withCrmEdit(request, organisationId, async ({ requestId, tenant }) => {
        const lead = await crmService.updateLeadStatus(
          body.leadId,
          brandId,
          organisationId,
          body.status,
          body.reason,
          tenant!,
        );
        return apiSuccess({ lead }, { requestId });
      });

    case "assignOwner":
      return withCrmAssignOwner(request, organisationId, async ({ requestId, tenant }) => {
        const lead = await crmService.assignOwner(
          body.leadId,
          brandId,
          organisationId,
          body.ownerUserId,
          tenant!,
        );
        return apiSuccess({ lead }, { requestId });
      });

    case "linkIdentity":
      return withCrmEdit(request, organisationId, async ({ requestId, tenant }) => {
        const lead = await crmService.getLead(body.leadId, brandId, organisationId, tenant!);
        if (!lead.personId) throw new AppError("VALIDATION_ERROR", "Lead has no linked person.");
        const link = await crmService.linkIdentity(
          lead.personId,
          brandId,
          organisationId,
          { linkType: body.linkType, externalId: body.externalId, evidence: body.evidence },
          tenant!,
        );
        return apiSuccess({ link }, { requestId });
      });

    case "detectDuplicates":
      return withCrmManageDuplicates(request, organisationId, async ({ requestId, tenant }) => {
        const result = await crmService.detectDuplicates(brandId, organisationId, body, tenant!);
        return apiSuccess(result, { requestId });
      });

    case "previewMerge":
      return withCrmMergeRecords(request, organisationId, async ({ requestId, tenant }) => {
        const preview = await crmService.previewMerge(
          body.sourceLeadId,
          body.destinationLeadId,
          brandId,
          organisationId,
          tenant!,
        );
        return apiSuccess({ preview }, { requestId });
      });

    case "executeMerge":
      return withCrmMergeRecords(request, organisationId, async ({ requestId, tenant }) => {
        const result = await crmService.executeMerge(
          body.sourceLeadId,
          body.destinationLeadId,
          brandId,
          organisationId,
          tenant!,
        );
        return apiSuccess({ result }, { requestId });
      });

    case "importLeads":
      return withCrmCreate(request, organisationId, async ({ requestId, tenant }) => {
        const result = await crmService.importLeadsCsv(
          brandId,
          organisationId,
          body.rows ?? [],
          body.mapping ?? { email: "email", name: "name" },
          tenant!,
        );
        return apiSuccess({ result }, { requestId });
      });

    case "createCustomField":
      return withCrmManageCustomFields(request, organisationId, async ({ requestId, tenant }) => {
        const field = await crmService.createCustomField(
          brandId,
          organisationId,
          {
            entityType: body.entityType ?? "LEAD",
            fieldKey: body.fieldKey,
            label: body.label,
            fieldType: body.fieldType,
            options: body.options,
          },
          tenant!,
        );
        return apiSuccess({ field }, { requestId });
      });

    default:
      throw new AppError("VALIDATION_ERROR", `Unknown action: ${body.action}`);
  }
}
