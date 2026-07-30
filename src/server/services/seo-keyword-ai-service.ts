import { brandContextBuilder } from "@/lib/ai/brand-context-builder";
import {
  keywordEntityExtractionSchema,
  keywordIntentAiSchema,
  keywordSuggestionSchema,
} from "@/lib/ai/keyword-output-schemas";
import { AppError } from "@/lib/errors";
import { prisma } from "@/lib/database/prisma";
import type { Prisma } from "@prisma/client";
import type { TenantContext } from "@/lib/tenancy/context";
import { aiRequestService } from "@/server/services/ai-request-service";
import { brandKnowledgeService } from "@/server/services/brand-knowledge-service";
import { seoKeywordService } from "@/server/services/seo-keyword-service";
import { brandService } from "@/server/services/workspace-service";

export const seoKeywordAiService = {
  async suggestKeywords(
    brandId: string,
    organisationId: string,
    input: { seedKeyword: string; siteId?: string; maxSuggestions?: number },
    context: TenantContext,
  ) {
    const brand = await brandService.getById(brandId, organisationId, context);
    const snapshot = await brandKnowledgeService.getSnapshot(brandId, organisationId, context);
    const brandContext = brandContextBuilder.build(snapshot, {});

    const result = await aiRequestService.executeStructured(
      {
        organisationId,
        projectId: brand.projectId,
        brandId,
        userProfileId: context.userProfileId,
        purpose: "SEO_ANALYSIS",
        templateKey: "seo.keywords.suggest",
        userInput: [
          `Suggest up to ${input.maxSuggestions ?? 10} keyword variants for: "${input.seedKeyword}"`,
          "Return suggestions only — do NOT invent search volume, CPC, difficulty, or ranking data.",
          "Label all suggestions as AI-generated concepts, not verified search demand.",
        ].join("\n"),
        brandContext: brandContext as unknown as Record<string, unknown>,
        schemaKey: "seo.keywords.suggest",
      },
      context,
    );

    const parsed = keywordSuggestionSchema.parse(result.output);
    const suggestions = [];
    for (const item of parsed.suggestions) {
      const keyword = await seoKeywordService.upsert(
        brandId,
        organisationId,
        {
          keyword: item.keyword,
          siteId: input.siteId,
          sourceType: "AI_SUGGESTION",
          provider: "AI",
          isSuggestion: true,
          externalId: `ai:${input.seedKeyword}:${item.keyword}`,
        },
        context,
      );
      suggestions.push({ keyword, rationale: item.rationale, isSuggestion: true });
    }

    return { suggestions, disclaimer: parsed.disclaimer };
  },

  async extractEntities(
    keywordId: string,
    brandId: string,
    organisationId: string,
    context: TenantContext,
  ) {
    const brand = await brandService.getById(brandId, organisationId, context);
    const keyword = await seoKeywordService.getById(keywordId, brandId, organisationId, context);
    const snapshot = await brandKnowledgeService.getSnapshot(brandId, organisationId, context);
    const brandContext = brandContextBuilder.build(snapshot, {});

    const result = await aiRequestService.executeStructured(
      {
        organisationId,
        projectId: brand.projectId,
        brandId,
        userProfileId: context.userProfileId,
        purpose: "SEO_ANALYSIS",
        templateKey: "seo.keywords.entities",
        userInput: `Extract entities from keyword: "${keyword.displayKeyword}"`,
        brandContext: brandContext as unknown as Record<string, unknown>,
        schemaKey: "seo.keywords.entities",
      },
      context,
    );

    const parsed = keywordEntityExtractionSchema.parse(result.output);
    const entities = [];
    for (const entity of parsed.entities) {
      const created = await prisma.seoKeywordEntity.create({
        data: {
          organisationId,
          keywordId,
          entityType: entity.entityType,
          canonicalValue: entity.canonicalValue,
          confidence: entity.confidence,
          source: "ai",
          isConfirmed: false,
        },
      });
      entities.push(created);
    }

    return entities;
  },

  async classifyIntentWithAi(
    keywordId: string,
    brandId: string,
    organisationId: string,
    context: TenantContext,
  ) {
    const keyword = await seoKeywordService.getById(keywordId, brandId, organisationId, context);
    const manualOverride = keyword.intents.find((i) => i.isManualOverride);
    if (manualOverride) {
      throw new AppError("VALIDATION_ERROR", "Cannot auto-classify: manual override exists.");
    }

    const brand = await brandService.getById(brandId, organisationId, context);
    const result = await aiRequestService.executeStructured(
      {
        organisationId,
        projectId: brand.projectId,
        brandId,
        userProfileId: context.userProfileId,
        purpose: "SEO_ANALYSIS",
        templateKey: "seo.keywords.intent",
        userInput: `Classify search intent for: "${keyword.displayKeyword}"`,
        schemaKey: "seo.keywords.intent",
      },
      context,
    );

    const parsed = keywordIntentAiSchema.parse(result.output);
    await prisma.seoKeywordIntent.create({
      data: {
        organisationId,
        keywordId,
        intent: parsed.intent,
        confidence: parsed.confidence,
        source: "ai",
        evidence: { reasoning: parsed.reasoning } as Prisma.InputJsonValue,
        modelId: result.model,
      },
    });

    return prisma.seoKeyword.update({
      where: { id: keywordId },
      data: { primaryIntent: parsed.intent },
    });
  },
};
