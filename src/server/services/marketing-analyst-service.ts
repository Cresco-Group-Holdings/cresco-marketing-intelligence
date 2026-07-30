import type { MarketingAnalystActionType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import type { MarketingAnalystOutput } from "@/lib/ai/analyst-output-schemas";
import { brandContextBuilder } from "@/lib/ai/brand-context-builder";
import { aiModelRegistry } from "@/lib/ai/model-registry";
import {
  buildAnalystAllowedContext,
  validateAnalystOutput,
} from "@/lib/analyst/ai-validation";
import { detectAnomalies } from "@/lib/analyst/anomaly-detection";
import type { BriefType } from "@/lib/analyst/constants";
import { BRIEF_TYPES } from "@/lib/analyst/constants";
import { buildDeterministicAnalystOutput } from "@/lib/analyst/deterministic-output";
import { buildEvidencePackage } from "@/lib/analyst/evidence-package";
import { planQueries } from "@/lib/analyst/query-planner";
import type { TenantContext } from "@/lib/tenancy/context";
import { aiRequestService } from "@/server/services/ai-request-service";
import { attributionDashboardService } from "@/server/services/attribution-dashboard-service";
import { executiveDashboardService } from "@/server/services/executive-dashboard-service";
import { brandKnowledgeService } from "@/server/services/brand-knowledge-service";
import { brandService } from "@/server/services/workspace-service";
import { contentService } from "@/server/services/content-service";

export const marketingAnalystService = {
  async gatherEvidence(
    brandId: string,
    organisationId: string,
    from: Date,
    to: Date,
    context: TenantContext,
  ) {
    const [overview, warningsResult, dataHealth, attribution] = await Promise.all([
      executiveDashboardService.getOverview(brandId, organisationId, from, to, "PREVIOUS_PERIOD", context),
      executiveDashboardService.getWarnings(brandId, organisationId, from, to, context),
      executiveDashboardService.getDataHealth(brandId, organisationId, context).catch(() => null),
      attributionDashboardService.getOverview(brandId, organisationId, from, to, context).catch(() => null),
    ]);

    const anomalies = detectAnomalies(overview.kpis).map((a) => ({
      metricKey: a.metricKey,
      direction: a.direction,
      changePercent: a.changePercent,
      method: a.method,
      sampleSize: a.sampleSize,
    }));

    return buildEvidencePackage({
      overview,
      warnings: warningsResult.warnings,
      anomalies,
      dataHealth: dataHealth ?? undefined,
      attributionModel: attribution?.directTrafficPolicy ?? null,
    });
  },

  async ask(
    brandId: string,
    organisationId: string,
    question: string,
    context: TenantContext,
    options?: { dateRangeDays?: number; filters?: Record<string, unknown> },
    requestId?: string,
  ) {
    const brand = await brandService.getById(brandId, organisationId, context);
    const days = options?.dateRangeDays ?? 28;
    const to = new Date();
    const from = new Date(to.getTime() - days * 86_400_000);

    const plannedQueries = planQueries(question, days);
    const evidence = await this.gatherEvidence(brandId, organisationId, from, to, context);

    const run = await prisma.marketingAnalystRun.create({
      data: {
        organisationId,
        projectId: brand.projectId,
        brandId,
        userProfileId: context.userProfileId,
        runType: "QUESTION",
        question,
        status: "PENDING",
        evidencePackage: { ...evidence, plannedQueries } as Prisma.InputJsonValue,
        filters: (options?.filters ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });

    const output = await this.generateAnalysis({
      brandId,
      organisationId,
      projectId: brand.projectId,
      question,
      evidence,
      context,
      requestId,
    });

    const updated = await prisma.marketingAnalystRun.update({
      where: { id: run.id },
      data: {
        status: "COMPLETED",
        structuredOutput: output.result as Prisma.InputJsonValue,
        outputSource: output.source,
        aiRequestId: output.aiRequestId,
        completedAt: new Date(),
      },
    });

    await this.persistRecommendations(updated.id, brand, output.result);

    return { run: updated, output: output.result, evidence, plannedQueries };
  },

  async generateBrief(
    brandId: string,
    organisationId: string,
    briefType: BriefType,
    context: TenantContext,
    requestId?: string,
  ) {
    const brand = await brandService.getById(brandId, organisationId, context);
    const config = BRIEF_TYPES[briefType];
    const to = new Date();
    const from = new Date(to.getTime() - config.days * 86_400_000);
    const evidence = await this.gatherEvidence(brandId, organisationId, from, to, context);

    const run = await prisma.marketingAnalystRun.create({
      data: {
        organisationId,
        projectId: brand.projectId,
        brandId,
        userProfileId: context.userProfileId,
        runType: "BRIEF",
        briefType,
        status: "PENDING",
        evidencePackage: evidence as unknown as Prisma.InputJsonValue,
      },
    });

    const output = await this.generateAnalysis({
      brandId,
      organisationId,
      projectId: brand.projectId,
      question: `Generate a ${config.label} marketing brief covering what changed, anomalies, opportunities, risks, and recommended actions.`,
      evidence,
      context,
      requestId,
    });

    const updated = await prisma.marketingAnalystRun.update({
      where: { id: run.id },
      data: {
        status: "COMPLETED",
        structuredOutput: output.result as Prisma.InputJsonValue,
        outputSource: output.source,
        aiRequestId: output.aiRequestId,
        completedAt: new Date(),
      },
    });

    await this.persistRecommendations(updated.id, brand, output.result);
    return { run: updated, output: output.result, evidence };
  },

  async generateAnalysis(input: {
    brandId: string;
    organisationId: string;
    projectId: string;
    question: string;
    evidence: ReturnType<typeof buildEvidencePackage>;
    context: TenantContext;
    requestId?: string;
  }) {
    const allowedContext = buildAnalystAllowedContext(input.evidence);
    const deterministic = buildDeterministicAnalystOutput(input.evidence);

    const snapshot = await brandKnowledgeService.getSnapshot(
      input.brandId,
      input.organisationId,
      input.context,
    );
    const brandContext = brandContextBuilder.build(snapshot, {});

    const userInput = [
      input.question,
      "",
      "Evidence package (use only these values):",
      JSON.stringify(input.evidence, null, 2),
      "",
      "Classify claims appropriately. Do not claim causation without evidence.",
    ].join("\n");

    try {
      const resolvedModel = aiModelRegistry.resolveModel();
      const aiResult = await aiRequestService.executeStructured(
        {
          organisationId: input.organisationId,
          projectId: input.projectId,
          brandId: input.brandId,
          userProfileId: input.context.userProfileId,
          purpose: "ANALYTICS_INSIGHT",
          templateKey: "analyst.marketing.analyze",
          schemaKey: "analyst.marketing.analyze",
          provider: resolvedModel.provider,
          model: resolvedModel.modelId,
          userInput,
          brandContext,
          requestId: input.requestId,
        },
        input.context,
      );

      const output = aiResult.output as MarketingAnalystOutput;
      validateAnalystOutput(output, allowedContext);

      return { result: output, source: "AI" as const, aiRequestId: aiResult.requestId };
    } catch {
      return { result: deterministic, source: "DETERMINISTIC_FALLBACK" as const };
    }
  },

  async persistRecommendations(
    runId: string,
    brand: { id: string; projectId: string; organisationId: string },
    output: MarketingAnalystOutput,
  ) {
    for (const action of output.recommendedActions) {
      await prisma.marketingAnalystRecommendation.create({
        data: {
          organisationId: brand.organisationId,
          projectId: brand.projectId,
          brandId: brand.id,
          analystRunId: runId,
          actionType: action.actionType as MarketingAnalystActionType,
          title: action.title,
          description: action.description,
          priority: action.priority,
        },
      });
    }
  },

  async listRuns(
    brandId: string,
    organisationId: string,
    context: TenantContext,
    options?: { savedOnly?: boolean; limit?: number },
  ) {
    await brandService.getById(brandId, organisationId, context);
    return prisma.marketingAnalystRun.findMany({
      where: {
        brandId,
        organisationId,
        ...(options?.savedOnly ? { isSaved: true } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: options?.limit ?? 50,
      include: { recommendations: { where: { status: "OPEN" } } },
    });
  },

  async getRun(brandId: string, organisationId: string, runId: string, context: TenantContext) {
    await brandService.getById(brandId, organisationId, context);
    const run = await prisma.marketingAnalystRun.findFirst({
      where: { id: runId, brandId, organisationId },
      include: { recommendations: true },
    });
    if (!run) return null;
    return run;
  },

  async saveRun(brandId: string, organisationId: string, runId: string, context: TenantContext) {
    await brandService.getById(brandId, organisationId, context);
    return prisma.marketingAnalystRun.update({
      where: { id: runId },
      data: { isSaved: true },
    });
  },

  async listRecommendations(brandId: string, organisationId: string, context: TenantContext) {
    await brandService.getById(brandId, organisationId, context);
    return prisma.marketingAnalystRecommendation.findMany({
      where: { brandId, organisationId, status: "OPEN" },
      orderBy: [{ priority: "asc" }, { createdAt: "desc" }],
      include: { analystRun: true },
    });
  },

  async dismissRecommendation(
    brandId: string,
    organisationId: string,
    recommendationId: string,
    context: TenantContext,
  ) {
    await brandService.getById(brandId, organisationId, context);
    return prisma.marketingAnalystRecommendation.update({
      where: { id: recommendationId },
      data: { status: "DISMISSED", dismissedAt: new Date() },
    });
  },

  async createActionFromRecommendation(
    brandId: string,
    organisationId: string,
    recommendationId: string,
    context: TenantContext,
    requestId?: string,
  ) {
    const brand = await brandService.getById(brandId, organisationId, context);
    const recommendation = await prisma.marketingAnalystRecommendation.findFirst({
      where: { id: recommendationId, brandId, organisationId },
    });
    if (!recommendation) return null;

    let linkedResourceType: string | null = null;
    let linkedResourceId: string | null = null;

    if (recommendation.actionType === "CONTENT_BRIEF") {
      const content = await contentService.create(
        brandId,
        organisationId,
        {
          title: recommendation.title,
          contentType: "TEXT_POST",
          primaryMessage: recommendation.description,
          campaignName: "Analyst recommendation",
        },
        context,
        requestId,
      );
      linkedResourceType = "ContentItem";
      linkedResourceId = content.id;
    }

    if (recommendation.actionType === "EXPERIMENT") {
      const experiment = await prisma.growthExperiment.create({
        data: {
          organisationId,
          projectId: brand.projectId,
          brandId,
          title: recommendation.title,
          hypothesis: recommendation.description,
          status: "PLANNED",
          createdByUserId: context.userProfileId,
        },
      });
      linkedResourceType = "GrowthExperiment";
      linkedResourceId = experiment.id;
    }

    return prisma.marketingAnalystRecommendation.update({
      where: { id: recommendationId },
      data: {
        status: "ACTIONED",
        actionedAt: new Date(),
        linkedResourceType,
        linkedResourceId,
      },
    });
  },
};
