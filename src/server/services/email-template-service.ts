import type { EmailMessageCategory, Prisma } from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import { extractTemplateVariables, renderTemplate, validateTemplateVariables } from "@/lib/email/template-variables";
import { requiresComplianceFooter, sanitiseEmailHtml } from "@/lib/email/template-sanitise";
import { AppError } from "@/lib/errors";
import type { TenantContext } from "@/lib/tenancy/context";
import { brandService } from "@/server/services/workspace-service";

export const emailTemplateService = {
  async listTemplates(brandId: string, organisationId: string, context: TenantContext) {
    await brandService.getById(brandId, organisationId, context);
    return prisma.emailTemplate.findMany({
      where: { organisationId, OR: [{ brandId }, { brandId: null }] },
      include: { versions: { orderBy: { versionNumber: "desc" }, take: 1 } },
      orderBy: { name: "asc" },
    });
  },

  async createTemplate(
    brandId: string,
    organisationId: string,
    input: {
      name: string;
      slug: string;
      category: EmailMessageCategory;
      subject: string;
      preheader?: string;
      htmlBody: string;
      plainTextBody?: string;
      language?: string;
      requiresUnsubscribe?: boolean;
      complianceFooter?: string;
      allowedCrmFields?: string[];
    },
    context: TenantContext,
  ) {
    await brandService.getById(brandId, organisationId, context);

    const { sanitised, blocked } = sanitiseEmailHtml(input.htmlBody);
    if (blocked.length > 0 && blocked.includes("script tags")) {
      throw new AppError("VALIDATION_ERROR", "Template contains unsafe HTML content.");
    }

    const variables = extractTemplateVariables(`${input.subject} ${sanitised} ${input.plainTextBody ?? ""}`);
    const validation = validateTemplateVariables(variables, input.allowedCrmFields ?? []);
    if (!validation.valid) throw new AppError("VALIDATION_ERROR", validation.errors[0] ?? "Invalid variables.");

    if (requiresComplianceFooter(input.category) && !input.complianceFooter && !input.requiresUnsubscribe) {
      throw new AppError("VALIDATION_ERROR", "Marketing templates require unsubscribe or compliance footer.");
    }

    return prisma.$transaction(async (tx) => {
      const template = await tx.emailTemplate.create({
        data: {
          organisationId,
          brandId,
          name: input.name,
          slug: input.slug,
          category: input.category,
        },
      });
      const version = await tx.emailTemplateVersion.create({
        data: {
          templateId: template.id,
          versionNumber: 1,
          status: "DRAFT",
          subject: input.subject,
          preheader: input.preheader,
          htmlBody: sanitised,
          plainTextBody: input.plainTextBody,
          variables: validation.approved,
          language: input.language ?? "en",
          requiresUnsubscribe: input.requiresUnsubscribe ?? requiresComplianceFooter(input.category),
          complianceFooter: input.complianceFooter,
          createdByUserId: context.userProfileId,
        },
      });
      await tx.emailTemplate.update({
        where: { id: template.id },
        data: { currentVersionId: version.id },
      });
      return { template, version };
    });
  },

  async createVersion(
    templateId: string,
    brandId: string,
    organisationId: string,
    input: {
      subject: string;
      preheader?: string;
      htmlBody: string;
      plainTextBody?: string;
      allowedCrmFields?: string[];
    },
    context: TenantContext,
  ) {
    await brandService.getById(brandId, organisationId, context);
    const template = await prisma.emailTemplate.findFirst({
      where: { id: templateId, organisationId },
      include: { versions: { orderBy: { versionNumber: "desc" }, take: 1 } },
    });
    if (!template) throw new AppError("NOT_FOUND", "Template not found.");

    const { sanitised } = sanitiseEmailHtml(input.htmlBody);
    const variables = extractTemplateVariables(`${input.subject} ${sanitised}`);
    const validation = validateTemplateVariables(variables, input.allowedCrmFields ?? []);
    if (!validation.valid) throw new AppError("VALIDATION_ERROR", validation.errors[0] ?? "Invalid variables.");

    const nextVersion = (template.versions[0]?.versionNumber ?? 0) + 1;
    return prisma.emailTemplateVersion.create({
      data: {
        templateId,
        versionNumber: nextVersion,
        status: "DRAFT",
        subject: input.subject,
        preheader: input.preheader,
        htmlBody: sanitised,
        plainTextBody: input.plainTextBody,
        variables: validation.approved,
        requiresUnsubscribe: requiresComplianceFooter(template.category),
        createdByUserId: context.userProfileId,
      },
    });
  },

  async approveVersion(versionId: string, brandId: string, organisationId: string, context: TenantContext) {
    await brandService.getById(brandId, organisationId, context);
    const version = await prisma.emailTemplateVersion.findFirst({
      where: { id: versionId, template: { organisationId } },
    });
    if (!version) throw new AppError("NOT_FOUND", "Template version not found.");

    return prisma.$transaction(async (tx) => {
      const approved = await tx.emailTemplateVersion.update({
        where: { id: versionId },
        data: { status: "APPROVED", approvedByUserId: context.userProfileId, approvedAt: new Date() },
      });
      await tx.emailTemplate.update({
        where: { id: version.templateId },
        data: { currentVersionId: versionId },
      });
      return approved;
    });
  },

  async previewVersion(
    versionId: string,
    brandId: string,
    organisationId: string,
    variables: Record<string, string>,
    context: TenantContext,
  ) {
    await brandService.getById(brandId, organisationId, context);
    const version = await prisma.emailTemplateVersion.findFirst({
      where: { id: versionId, template: { organisationId } },
    });
    if (!version) throw new AppError("NOT_FOUND", "Template version not found.");

    const subject = renderTemplate(version.subject, variables);
    const html = renderTemplate(version.htmlBody, variables);
    const text = version.plainTextBody ? renderTemplate(version.plainTextBody, variables) : null;

    return {
      subject: subject.rendered,
      html: html.rendered,
      plainText: text?.rendered,
      missingVariables: [...new Set([...subject.missing, ...html.missing, ...(text?.missing ?? [])])],
    };
  },
};
