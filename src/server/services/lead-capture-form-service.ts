import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import { validateFieldDefinition } from "@/lib/lead-capture-forms/field-validation";
import { validateRedirectUrl } from "@/lib/lead-capture-forms/security";
import { AppError } from "@/lib/errors";
import type { TenantContext } from "@/lib/tenancy/context";
import { brandService } from "@/server/services/workspace-service";

const formInclude = {
  versions: {
    orderBy: { versionNumber: "desc" as const },
    include: {
      fields: { include: { options: true }, orderBy: { sortOrder: "asc" as const } },
      steps: { orderBy: { sortOrder: "asc" as const } },
      consentBlocks: { orderBy: { sortOrder: "asc" as const } },
    },
  },
  rules: { orderBy: { priority: "asc" as const } },
  thankYouActions: { orderBy: { sortOrder: "asc" as const } },
  installations: true,
  _count: { select: { submissions: true } },
} satisfies Prisma.LeadCaptureFormInclude;

export type CreateFormInput = {
  name: string;
  slug: string;
  formType?: string;
  description?: string;
  allowedOrigins?: string[];
};

export const leadCaptureFormService = {
  async listForms(brandId: string, organisationId: string, context: TenantContext) {
    await brandService.getById(brandId, organisationId, context);
    return prisma.leadCaptureForm.findMany({
      where: { organisationId, brandId, archivedAt: null },
      include: { _count: { select: { submissions: true, versions: true } } },
      orderBy: { updatedAt: "desc" },
      take: 100,
    });
  },

  async getForm(formId: string, brandId: string, organisationId: string, context: TenantContext) {
    await brandService.getById(brandId, organisationId, context);
    const form = await prisma.leadCaptureForm.findFirst({
      where: { id: formId, organisationId, brandId },
      include: formInclude,
    });
    if (!form) throw new AppError("NOT_FOUND", "Form not found.");
    return form;
  },

  async getFormByPublicId(publicFormId: string) {
    const form = await prisma.leadCaptureForm.findUnique({
      where: { publicFormId },
      include: {
        versions: {
          where: { isActive: true },
          include: {
            fields: { include: { options: true }, orderBy: { sortOrder: "asc" } },
            steps: { orderBy: { sortOrder: "asc" } },
            consentBlocks: { orderBy: { sortOrder: "asc" } },
          },
          take: 1,
        },
        thankYouActions: { orderBy: { sortOrder: "asc" } },
      },
    });
    if (!form) throw new AppError("NOT_FOUND", "Form not found.");
    return form;
  },

  async createForm(brandId: string, organisationId: string, input: CreateFormInput, context: TenantContext) {
    const brand = await brandService.getById(brandId, organisationId, context);
    return prisma.$transaction(async (tx) => {
      const form = await tx.leadCaptureForm.create({
        data: {
          organisationId,
          projectId: brand.projectId,
          brandId,
          name: input.name,
          slug: input.slug,
          formType: (input.formType ?? "CONTACT") as Prisma.LeadCaptureFormCreateInput["formType"],
          description: input.description,
          allowedOrigins: input.allowedOrigins ?? [],
          createdByUserId: context.userProfileId,
        },
      });
      const version = await tx.leadCaptureFormVersion.create({
        data: { formId: form.id, versionNumber: 1, label: "Initial version", isActive: true },
      });
      await tx.leadCaptureForm.update({
        where: { id: form.id },
        data: { currentVersionId: version.id },
      });
      return tx.leadCaptureForm.findUnique({
        where: { id: form.id },
        include: formInclude,
      });
    });
  },

  async addField(
    formId: string,
    brandId: string,
    organisationId: string,
    input: {
      fieldKey: string;
      fieldType: string;
      label: string;
      helpText?: string;
      placeholder?: string;
      isRequired?: boolean;
      sortOrder?: number;
      isHoneypot?: boolean;
      options?: Array<{ value: string; label: string }>;
    },
    context: TenantContext,
  ) {
    const form = await this.getForm(formId, brandId, organisationId, context);
    const version = form.versions.find((v) => v.isActive) ?? form.versions[0];
    if (!version) throw new AppError("VALIDATION_ERROR", "No form version available.");
    const validation = validateFieldDefinition(input);
    if (!validation.valid) throw new AppError("VALIDATION_ERROR", validation.errors.join(" "));

    return prisma.$transaction(async (tx) => {
      const field = await tx.leadCaptureField.create({
        data: {
          versionId: version.id,
          fieldKey: input.fieldKey,
          fieldType: input.fieldType as Prisma.LeadCaptureFieldCreateInput["fieldType"],
          label: input.label,
          helpText: input.helpText,
          placeholder: input.placeholder,
          isRequired: input.isRequired ?? false,
          sortOrder: input.sortOrder ?? 0,
          isHoneypot: input.isHoneypot ?? false,
        },
      });
      if (input.options?.length) {
        for (const [i, opt] of input.options.entries()) {
          await tx.leadCaptureFieldOption.create({
            data: { fieldId: field.id, value: opt.value, label: opt.label, sortOrder: i },
          });
        }
      }
      return field;
    });
  },

  async publishForm(formId: string, brandId: string, organisationId: string, context: TenantContext) {
    const form = await this.getForm(formId, brandId, organisationId, context);
    const version = form.versions.find((v) => v.isActive) ?? form.versions[0];
    if (!version || version.fields.length === 0) {
      throw new AppError("VALIDATION_ERROR", "Form must have at least one field before publishing.");
    }
    return prisma.leadCaptureForm.update({
      where: { id: form.id },
      data: { status: "ACTIVE", currentVersionId: version.id },
      include: formInclude,
    });
  },

  async createVersion(formId: string, brandId: string, organisationId: string, context: TenantContext) {
    const form = await this.getForm(formId, brandId, organisationId, context);
    const latest = form.versions[0];
    const nextNumber = (latest?.versionNumber ?? 0) + 1;
    return prisma.leadCaptureFormVersion.create({
      data: {
        formId: form.id,
        versionNumber: nextNumber,
        label: `Version ${nextNumber}`,
        isActive: false,
      },
    });
  },

  async addThankYouAction(
    formId: string,
    brandId: string,
    organisationId: string,
    input: { actionType: string; redirectUrl?: string; config?: Record<string, unknown> },
    context: TenantContext,
  ) {
    const form = await this.getForm(formId, brandId, organisationId, context);
    let isRedirectValidated = false;
    if (input.redirectUrl) {
      const check = validateRedirectUrl(input.redirectUrl, form.allowedOrigins);
      if (!check.valid) throw new AppError("VALIDATION_ERROR", check.error ?? "Invalid redirect URL");
      isRedirectValidated = true;
    }
    return prisma.leadCaptureThankYouAction.create({
      data: {
        formId: form.id,
        actionType: input.actionType as Prisma.LeadCaptureThankYouActionCreateInput["actionType"],
        redirectUrl: input.redirectUrl,
        config: input.config as Prisma.InputJsonValue,
        isRedirectValidated,
      },
    });
  },

  async getAnalytics(formId: string, brandId: string, organisationId: string, context: TenantContext) {
    const form = await this.getForm(formId, brandId, organisationId, context);
    const [total, accepted, quarantined] = await Promise.all([
      prisma.leadCaptureSubmission.count({ where: { formId: form.id } }),
      prisma.leadCaptureSubmission.count({ where: { formId: form.id, status: "ACCEPTED" } }),
      prisma.leadCaptureSubmission.count({ where: { formId: form.id, status: "QUARANTINED" } }),
    ]);
    return { formId: form.id, total, accepted, quarantined, views: null, starts: null };
  },

  async listSubmissions(formId: string, brandId: string, organisationId: string, context: TenantContext) {
    await this.getForm(formId, brandId, organisationId, context);
    return prisma.leadCaptureSubmission.findMany({
      where: { formId },
      include: { values: true, spamAssessment: true, consentRecords: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  },
};
