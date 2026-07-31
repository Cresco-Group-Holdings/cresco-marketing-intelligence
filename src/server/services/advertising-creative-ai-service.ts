import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import { brandContextBuilder } from "@/lib/ai/brand-context-builder";
import { ADVERTISING_CREATIVE_OUTPUT_SCHEMAS } from "@/lib/ai/advertising-creative-output-schemas";
import { validateCopyFields } from "@/lib/advertising-creatives/copy-limits";
import { getFormatSpec } from "@/lib/advertising-creatives/format-specs";
import { runAdCreativeComplianceChecks } from "@/lib/advertising-creatives/compliance";
import { validateProviderCreative } from "@/lib/advertising-creatives/provider-validation";
import type { TenantContext } from "@/lib/tenancy/context";
import { aiRequestService } from "@/server/services/ai-request-service";
import { brandKnowledgeService } from "@/server/services/brand-knowledge-service";
import { advertisingCreativeProjectService } from "@/server/services/advertising-creative-project-service";

export const advertisingCreativeAiService = {
  async generateConcepts(creativeId: string, brandId: string, organisationId: string, context: TenantContext) {
    const project = await advertisingCreativeProjectService.getById(creativeId, brandId, organisationId, context);
    const snapshot = await brandKnowledgeService.getSnapshot(brandId, organisationId, context);
    const brandContext = brandContextBuilder.build(snapshot, {});

    await prisma.advertisingCreativeProject.update({
      where: { id: creativeId },
      data: { status: "GENERATING" },
    });

    const result = await aiRequestService.executeStructured(
      {
        organisationId,
        projectId: project.projectId,
        brandId,
        userProfileId: context.userProfileId,
        purpose: "ADVERTISING_CREATIVE",
        templateKey: "advertising.creatives.concepts",
        userInput: [
          `Generate creative concepts for: ${project.name}`,
          `Objective: ${project.objectiveType ?? project.campaignPlan?.primaryObjective ?? "not set"}`,
          `Audience: ${project.audienceSummary ?? "from brand context"}`,
          `Format: ${project.primaryFormat ?? "not set"}`,
          "Do not fabricate performance claims or guaranteed results.",
          "Include compliance risks and recommended human review.",
        ].join("\n"),
        brandContext: brandContext as unknown as Record<string, unknown>,
        schemaKey: "advertising.creatives.concepts",
      },
      context,
    );

    const concept = await prisma.advertisingCreativeConcept.create({
      data: {
        organisationId,
        creativeProjectId: creativeId,
        category: (result.output.category as Prisma.AdvertisingCreativeConceptCreateInput["category"]) ?? "BENEFIT_LED",
        campaignObjective: result.output.campaignObjective,
        audienceSummary: result.output.audienceSummary,
        message: result.output.message,
        visualDirection: result.output.visualDirection,
        cta: result.output.cta,
        hypothesis: result.output.hypothesis,
        complianceRisk: result.output.complianceRisk,
        aiGenerated: true,
      },
    });

    await prisma.advertisingCreativeProject.update({
      where: { id: creativeId },
      data: { status: "DRAFT" },
    });

    return { concept, output: result.output };
  },

  async generateCopy(
    creativeId: string,
    brandId: string,
    organisationId: string,
    formatType: string,
    context: TenantContext,
  ) {
    const project = await advertisingCreativeProjectService.getById(creativeId, brandId, organisationId, context);
    const snapshot = await brandKnowledgeService.getSnapshot(brandId, organisationId, context);
    const brandContext = brandContextBuilder.build(snapshot, {});

    const result = await aiRequestService.executeStructured(
      {
        organisationId,
        projectId: project.projectId,
        brandId,
        userProfileId: context.userProfileId,
        purpose: "ADVERTISING_CREATIVE",
        templateKey: "advertising.creatives.copy",
        userInput: [
          `Generate ad copy for format: ${formatType}`,
          `Campaign: ${project.name}`,
          `Objective: ${project.objectiveType ?? "not set"}`,
          "Respect provider field limits. Do not truncate silently.",
          "Do not fabricate statistics or guaranteed outcomes.",
        ].join("\n"),
        brandContext: brandContext as unknown as Record<string, unknown>,
        schemaKey: "advertising.creatives.copy",
      },
      context,
    );

    const spec = getFormatSpec(formatType as never);
    const textLimits = spec.textLimits ?? {};
    const copies = [];

    for (const field of result.output.fields) {
      const maxLength = textLimits[field.fieldKey] ?? null;
      const validation = validateCopyFields([
        { fieldKey: field.fieldKey as never, value: field.value, maxLength },
      ]);

      const copy = await advertisingCreativeProjectService.upsertCopy(
        creativeId,
        brandId,
        organisationId,
        { fieldKey: field.fieldKey, fieldValue: field.value },
        context,
      );
      copies.push({ copy, validation: validation.results[0] });
    }

    return { copies, output: result.output };
  },

  async runProviderValidation(
    creativeId: string,
    brandId: string,
    organisationId: string,
    provider: string,
    formatType: string,
    context: TenantContext,
  ) {
    const project = await advertisingCreativeProjectService.getById(creativeId, brandId, organisationId, context);
    const spec = getFormatSpec(formatType as never);
    const textLimits = spec.textLimits ?? {};

    const copyFields = project.copies.map((c) => {
      const maxLength = c.maxLength ?? textLimits[c.fieldKey] ?? null;
      return {
        fieldKey: c.fieldKey as never,
        value: c.fieldValue,
        characterCount: c.characterCount,
        maxLength,
        valid: maxLength === null || c.characterCount <= maxLength,
        truncationWarning: c.truncationWarning,
      };
    });

    const complianceFindings = runAdCreativeComplianceChecks({
      copyText: project.copies.map((c) => c.fieldValue).join("\n"),
    });

    const validation = validateProviderCreative({
      provider,
      channelType: project.channelType ?? undefined,
      formatType: formatType as never,
      copyFields,
      assetCount: project.assets.length,
      hasDestination: Boolean(project.campaignPlan),
    });

    if (complianceFindings.some((f) => f.blocking)) {
      validation.errors.push("Blocking compliance findings detected.");
      validation.status = "FAILED";
    }

    const record = await prisma.advertisingCreativeProviderValidation.create({
      data: {
        organisationId,
        creativeProjectId: creativeId,
        formatId: project.formats[0]?.id,
        provider,
        channelType: project.channelType ?? undefined,
        validationStatus: validation.status,
        isLocalPrecheck: true,
        fieldResults: validation.fieldResults as Prisma.InputJsonValue,
        warnings: [...validation.warnings, ...complianceFindings.filter((f) => !f.blocking).map((f) => f.message)],
        errors: [...validation.errors, ...complianceFindings.filter((f) => f.blocking).map((f) => f.message)],
        validatedAt: new Date(),
      },
    });

    return { validation, record };
  },
};

void ADVERTISING_CREATIVE_OUTPUT_SCHEMAS;
