import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import { isValidContactValue, normaliseContactValue } from "@/lib/crm/contact-normalisation";
import { validateCustomFieldDefinition, validateCustomFieldValue } from "@/lib/crm/custom-fields";
import { buildDuplicateEvidence, canAutoMerge } from "@/lib/crm/duplicates";
import { validateIdentityLink, canAutoLink } from "@/lib/crm/identity-linking";
import { buildMergePreview } from "@/lib/crm/merge";
import { incrementCrmCounter, CRM_METRIC_NAMES } from "@/lib/crm/observability";
import { validateStatusTransition, validateLifecycleTransition } from "@/lib/crm/transitions";
import { sanitiseCsvRow, validateImportMapping } from "@/lib/crm/import-export";
import { AppError } from "@/lib/errors";
import type { TenantContext } from "@/lib/tenancy/context";
import { brandService } from "@/server/services/workspace-service";
import { recordAuditEvent } from "@/server/services/audit-service";

const leadInclude = {
  person: { include: { contactMethods: true, contact: true } },
  company: { include: { domains: true } },
  source: true,
  owner: { select: { id: true, displayName: true } },
  productInterests: true,
  statusHistory: { orderBy: { createdAt: "desc" as const }, take: 20 },
  lifecycleHistory: { orderBy: { createdAt: "desc" as const }, take: 20 },
  timelineItems: { orderBy: { occurredAt: "desc" as const }, take: 50 },
  tagLinks: { include: { tag: true } },
  customFieldValues: { include: { definition: true } },
  externalReferences: true,
} satisfies Prisma.CrmLeadInclude;

export type CreateCrmLeadInput = {
  status?: string;
  lifecycleStage?: string;
  primaryProductInterest?: string;
  preferredLanguage?: string;
  country?: string;
  timezone?: string;
  ownerUserId?: string;
  companyId?: string;
  marketingLeadId?: string;
  sourceType?: string;
  source?: {
    provider?: string;
    formName?: string;
    landingPage?: string;
    utmSource?: string;
    utmMedium?: string;
    utmCampaign?: string;
    firstTouchCampaign?: string;
    lastTouchCampaign?: string;
  };
  person?: {
    displayName?: string;
    contactMethods?: Array<{ methodType: string; value: string; isPrimary?: boolean }>;
  };
};

export const crmService = {
  async listLeads(brandId: string, organisationId: string, context: TenantContext, filters?: {
    status?: string;
    lifecycleStage?: string;
    ownerUserId?: string;
    search?: string;
  }) {
    await brandService.getById(brandId, organisationId, context);
    return prisma.crmLead.findMany({
      where: {
        organisationId,
        brandId,
        archivedAt: null,
        ...(filters?.status ? { status: filters.status as Prisma.EnumCrmLeadStatusFilter["equals"] } : {}),
        ...(filters?.lifecycleStage ? { lifecycleStage: filters.lifecycleStage as Prisma.EnumCrmLifecycleStageFilter["equals"] } : {}),
        ...(filters?.ownerUserId ? { ownerUserId: filters.ownerUserId } : {}),
      },
      include: leadInclude,
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  },

  async getLead(leadId: string, brandId: string, organisationId: string, context: TenantContext) {
    await brandService.getById(brandId, organisationId, context);
    const lead = await prisma.crmLead.findFirst({
      where: { id: leadId, organisationId, brandId },
      include: leadInclude,
    });
    if (!lead) throw new AppError("NOT_FOUND", "CRM lead not found.");
    return lead;
  },

  async createLead(brandId: string, organisationId: string, input: CreateCrmLeadInput, context: TenantContext) {
    const brand = await brandService.getById(brandId, organisationId, context);
    const status = input.status ?? "NEW";
    const lifecycleStage = input.lifecycleStage ?? "LEAD";
    const statusCheck = validateStatusTransition(status);
    const lifecycleCheck = validateLifecycleTransition(lifecycleStage);
    if (!statusCheck.valid || !lifecycleCheck.valid) {
      throw new AppError("VALIDATION_ERROR", statusCheck.error ?? lifecycleCheck.error ?? "Invalid transition");
    }

    return prisma.$transaction(async (tx) => {
      let personId: string | undefined;
      if (input.person) {
        const person = await tx.crmPerson.create({
          data: {
            organisationId,
            projectId: brand.projectId,
            brandId,
            displayName: input.person.displayName,
            preferredLanguage: input.preferredLanguage,
            country: input.country,
            timezone: input.timezone,
          },
        });
        personId = person.id;
        if (input.person.contactMethods?.length) {
          for (const method of input.person.contactMethods) {
            if (!isValidContactValue(method.methodType, method.value)) continue;
            await tx.crmContactMethod.create({
              data: {
                personId: person.id,
                methodType: method.methodType as Prisma.CrmContactMethodCreateInput["methodType"],
                normalisedValue: normaliseContactValue(method.methodType, method.value),
                displayValue: method.value,
                isPrimary: method.isPrimary ?? false,
                source: "MANUAL_ENTRY",
              },
            });
          }
        }
      }

      let sourceId: string | undefined;
      if (input.sourceType) {
        const source = await tx.crmLeadSource.create({
          data: {
            organisationId,
            projectId: brand.projectId,
            brandId,
            sourceType: input.sourceType as Prisma.CrmLeadSourceCreateInput["sourceType"],
            originalSourceType: input.sourceType as Prisma.CrmLeadSourceCreateInput["originalSourceType"],
            latestSourceType: input.sourceType as Prisma.CrmLeadSourceCreateInput["latestSourceType"],
            provider: input.source?.provider,
            formName: input.source?.formName,
            landingPage: input.source?.landingPage,
            utmSource: input.source?.utmSource,
            utmMedium: input.source?.utmMedium,
            utmCampaign: input.source?.utmCampaign,
            firstTouchCampaign: input.source?.firstTouchCampaign,
            lastTouchCampaign: input.source?.lastTouchCampaign,
          },
        });
        sourceId = source.id;
      }

      const lead = await tx.crmLead.create({
        data: {
          organisationId,
          projectId: brand.projectId,
          brandId,
          personId,
          companyId: input.companyId,
          sourceId,
          ownerUserId: input.ownerUserId,
          status: status as Prisma.CrmLeadCreateInput["status"],
          lifecycleStage: lifecycleStage as Prisma.CrmLeadCreateInput["lifecycleStage"],
          primaryProductInterest: input.primaryProductInterest,
          preferredLanguage: input.preferredLanguage,
          country: input.country,
          timezone: input.timezone,
          marketingLeadId: input.marketingLeadId,
          firstSeenAt: new Date(),
          lastActivityAt: new Date(),
          createdByUserId: context.userProfileId,
        },
        include: leadInclude,
      });

      await tx.crmLeadStatusHistory.create({
        data: { leadId: lead.id, newStatus: lead.status, actorUserId: context.userProfileId, source: "CREATE" },
      });
      await tx.crmLeadLifecycleHistory.create({
        data: { leadId: lead.id, newStage: lead.lifecycleStage, actorUserId: context.userProfileId, source: "CREATE" },
      });
      await tx.crmActivityTimelineItem.create({
        data: {
          organisationId,
          brandId,
          leadId: lead.id,
          itemType: "LEAD_CREATED",
          title: "Lead created",
          sourceSystem: "CRM",
          actorUserId: context.userProfileId,
        },
      });

      incrementCrmCounter(CRM_METRIC_NAMES.leadsCreated);
      if (!input.ownerUserId) incrementCrmCounter(CRM_METRIC_NAMES.unassignedLeads);

      return lead;
    });
  },

  async updateLeadStatus(
    leadId: string,
    brandId: string,
    organisationId: string,
    newStatus: string,
    reason: string | undefined,
    context: TenantContext,
  ) {
    const lead = await this.getLead(leadId, brandId, organisationId, context);
    const check = validateStatusTransition(newStatus);
    if (!check.valid) throw new AppError("VALIDATION_ERROR", check.error ?? "Invalid status transition");

    return prisma.$transaction(async (tx) => {
      await tx.crmLeadStatusHistory.create({
        data: {
          leadId,
          previousStatus: lead.status,
          newStatus: newStatus as Prisma.CrmLeadStatusHistoryCreateInput["newStatus"],
          actorUserId: context.userProfileId,
          reason,
          source: "MANUAL",
        },
      });
      await tx.crmActivityTimelineItem.create({
        data: {
          organisationId,
          brandId,
          leadId,
          itemType: "STATUS_CHANGE",
          title: `Status changed to ${newStatus}`,
          actorUserId: context.userProfileId,
          metadata: { previousStatus: lead.status, newStatus } as Prisma.InputJsonValue,
        },
      });
      return tx.crmLead.update({
        where: { id: leadId },
        data: { status: newStatus as Prisma.CrmLeadUpdateInput["status"], lastActivityAt: new Date() },
        include: leadInclude,
      });
    });
  },

  async assignOwner(leadId: string, brandId: string, organisationId: string, assigneeId: string, context: TenantContext) {
    await this.getLead(leadId, brandId, organisationId, context);
    return prisma.$transaction(async (tx) => {
      await tx.crmLeadAssignment.create({
        data: { leadId, assigneeId, assignedById: context.userProfileId, reason: "Manual assignment" },
      });
      return tx.crmLead.update({
        where: { id: leadId },
        data: { ownerUserId: assigneeId, lastActivityAt: new Date() },
        include: leadInclude,
      });
    });
  },

  async linkIdentity(
    personId: string,
    brandId: string,
    organisationId: string,
    input: { linkType: string; externalId: string; evidence?: string },
    context: TenantContext,
  ) {
    await brandService.getById(brandId, organisationId, context);
    const validation = validateIdentityLink({ ...input, verified: true });
    if (!validation.valid) throw new AppError("VALIDATION_ERROR", validation.errors.join(" "));
    if (!canAutoLink({ ...input, verified: true }) && input.linkType !== "STAFF_CONFIRMED") {
      throw new AppError("VALIDATION_ERROR", "This link type requires staff confirmation.");
    }
    return prisma.crmIdentityLink.create({
      data: {
        personId,
        linkType: input.linkType as Prisma.CrmIdentityLinkCreateInput["linkType"],
        externalId: input.externalId,
        evidence: input.evidence,
        confirmedAt: new Date(),
        confirmedByUserId: context.userProfileId,
      },
    });
  },

  async detectDuplicates(brandId: string, organisationId: string, input: {
    email?: string;
    phone?: string;
    externalProvider?: string;
    externalId?: string;
    authUserId?: string;
  }, context: TenantContext) {
    await brandService.getById(brandId, organisationId, context);
    const evidence = buildDuplicateEvidence(input);
    if (evidence.length === 0) return { candidates: [], evidence: [] };

    incrementCrmCounter(CRM_METRIC_NAMES.duplicateRate);
    return { evidence, autoMergeEligible: canAutoMerge(evidence) };
  },

  async previewMerge(
    sourceId: string,
    destinationId: string,
    brandId: string,
    organisationId: string,
    context: TenantContext,
  ) {
    const [source, destination] = await Promise.all([
      this.getLead(sourceId, brandId, organisationId, context),
      this.getLead(destinationId, brandId, organisationId, context),
    ]);
    return buildMergePreview(
      sourceId,
      destinationId,
      source as unknown as Record<string, unknown>,
      destination as unknown as Record<string, unknown>,
      source.timelineItems?.length ?? 0,
    );
  },

  async executeMerge(
    sourceId: string,
    destinationId: string,
    brandId: string,
    organisationId: string,
    context: TenantContext,
  ) {
    await brandService.getById(brandId, organisationId, context);
    const preview = await this.previewMerge(sourceId, destinationId, brandId, organisationId, context);

    return prisma.$transaction(async (tx) => {
      const operation = await tx.crmMergeOperation.create({
        data: {
          organisationId,
          sourceRecordType: "CrmLead",
          sourceRecordId: sourceId,
          destinationRecordType: "CrmLead",
          destinationRecordId: destinationId,
          fieldConflicts: preview.conflicts as Prisma.InputJsonValue,
          status: "COMPLETED",
          consentPreserved: true,
          attributionPreserved: true,
          rollbackStrategy: "Manual review required; source archived not deleted.",
          operatorUserId: context.userProfileId,
          completedAt: new Date(),
        },
      });

      await tx.crmLead.update({
        where: { id: sourceId },
        data: { archivedAt: new Date(), status: "ARCHIVED" },
      });

      await tx.crmDuplicateCandidate.create({
        data: {
          organisationId,
          brandId,
          sourceRecordType: "CrmLead",
          sourceRecordId: sourceId,
          targetRecordType: "CrmLead",
          targetRecordId: destinationId,
          matchEvidence: preview as unknown as Prisma.InputJsonValue,
          status: "MERGED",
          reviewedByUserId: context.userProfileId,
          reviewedAt: new Date(),
        },
      });

      incrementCrmCounter(CRM_METRIC_NAMES.mergeRate);
      await recordAuditEvent({
        organisationId,
        actorUserId: context.userProfileId,
        action: "crm.merge.completed",
        resourceType: "CrmMergeOperation",
        resourceId: operation.id,
      });

      return operation;
    });
  },

  async importLeadsCsv(
    brandId: string,
    organisationId: string,
    rows: Array<Record<string, string>>,
    mapping: Record<string, string>,
    context: TenantContext,
  ) {
    const brand = await brandService.getById(brandId, organisationId, context);
    const mappingCheck = validateImportMapping(mapping, ["email"]);
    if (!mappingCheck.valid) throw new AppError("VALIDATION_ERROR", mappingCheck.errors.join(" "));

    const job = await prisma.crmImportJob.create({
      data: {
        organisationId,
        projectId: brand.projectId,
        brandId,
        entityType: "LEAD",
        status: "PROCESSING",
        totalRows: rows.length,
        fieldMapping: mapping as Prisma.InputJsonValue,
        createdByUserId: context.userProfileId,
      },
    });

    let accepted = 0;
    let rejected = 0;
    const rejectedDetails: Array<{ row: number; reason: string }> = [];

    for (let i = 0; i < rows.length; i++) {
      const sanitised = sanitiseCsvRow(rows[i] as Record<string, string>);
      const email = sanitised[mapping.email ?? "email"];
      if (!email) {
        rejected++;
        rejectedDetails.push({ row: i + 1, reason: "Missing email" });
        continue;
      }
      try {
        await this.createLead(brandId, organisationId, {
          sourceType: "CSV_IMPORT",
          person: { displayName: sanitised[mapping.name ?? "name"], contactMethods: [{ methodType: "EMAIL", value: email, isPrimary: true }] },
        }, context);
        accepted++;
      } catch {
        rejected++;
        rejectedDetails.push({ row: i + 1, reason: "Validation failed" });
      }
    }

    if (rejected > 0) incrementCrmCounter(CRM_METRIC_NAMES.failedImports);

    return prisma.crmImportJob.update({
      where: { id: job.id },
      data: { status: "COMPLETED", acceptedRows: accepted, rejectedRows: rejected, rejectedDetails: rejectedDetails as Prisma.InputJsonValue, completedAt: new Date() },
    });
  },

  async createCustomField(
    brandId: string,
    organisationId: string,
    input: { entityType: string; fieldKey: string; label: string; fieldType: string; options?: string[] },
    context: TenantContext,
  ) {
    const brand = await brandService.getById(brandId, organisationId, context);
    const validation = validateCustomFieldDefinition(input);
    if (!validation.valid) throw new AppError("VALIDATION_ERROR", validation.errors.join(" "));

    return prisma.crmCustomFieldDefinition.create({
      data: {
        organisationId,
        projectId: brand.projectId,
        brandId,
        entityType: input.entityType,
        fieldKey: input.fieldKey,
        label: input.label,
        fieldType: input.fieldType as Prisma.CrmCustomFieldDefinitionCreateInput["fieldType"],
        options: input.options as Prisma.InputJsonValue,
      },
    });
  },

  async getDashboard(brandId: string, organisationId: string, context: TenantContext) {
    await brandService.getById(brandId, organisationId, context);
    const [leads, duplicates, companies, unassigned] = await Promise.all([
      prisma.crmLead.count({ where: { organisationId, brandId, archivedAt: null } }),
      prisma.crmDuplicateCandidate.count({ where: { organisationId, brandId, status: "PENDING" } }),
      prisma.crmCompany.count({ where: { organisationId, brandId, archivedAt: null } }),
      prisma.crmLead.count({ where: { organisationId, brandId, archivedAt: null, ownerUserId: null } }),
    ]);
    return { leads, duplicates, companies, unassigned };
  },

  async listContacts(brandId: string, organisationId: string, context: TenantContext) {
    await brandService.getById(brandId, organisationId, context);
    return prisma.crmContact.findMany({
      where: { organisationId, brandId, archivedAt: null },
      include: { person: { include: { contactMethods: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  },

  async getContact(contactId: string, brandId: string, organisationId: string, context: TenantContext) {
    await brandService.getById(brandId, organisationId, context);
    const contact = await prisma.crmContact.findFirst({
      where: { id: contactId, organisationId, brandId },
      include: { person: { include: { contactMethods: true, identityLinks: true } } },
    });
    if (!contact) throw new AppError("NOT_FOUND", "CRM contact not found.");
    return contact;
  },

  async listCompanies(brandId: string, organisationId: string, context: TenantContext) {
    await brandService.getById(brandId, organisationId, context);
    return prisma.crmCompany.findMany({
      where: { organisationId, brandId, archivedAt: null },
      include: { domains: true, owner: { select: { id: true, displayName: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  },

  async getCompany(companyId: string, brandId: string, organisationId: string, context: TenantContext) {
    await brandService.getById(brandId, organisationId, context);
    const company = await prisma.crmCompany.findFirst({
      where: { id: companyId, organisationId, brandId },
      include: { domains: true, owner: { select: { id: true, displayName: true } }, addresses: true },
    });
    if (!company) throw new AppError("NOT_FOUND", "CRM company not found.");
    return company;
  },

  async listDuplicateCandidates(brandId: string, organisationId: string, context: TenantContext) {
    await brandService.getById(brandId, organisationId, context);
    return prisma.crmDuplicateCandidate.findMany({
      where: { organisationId, brandId, status: "PENDING" },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  },

  async listCustomFields(brandId: string, organisationId: string, context: TenantContext) {
    await brandService.getById(brandId, organisationId, context);
    return prisma.crmCustomFieldDefinition.findMany({
      where: { organisationId, brandId, archivedAt: null },
      orderBy: { sortOrder: "asc" },
    });
  },
};
