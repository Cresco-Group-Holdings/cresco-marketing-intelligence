import { z } from "zod";
import { Prisma } from "@prisma/client";
import { ANALYST_OUTPUT_SCHEMAS } from "@/lib/ai/analyst-output-schemas";
import { TOPIC_OUTPUT_SCHEMAS } from "@/lib/ai/topic-output-schemas";
import { BRIEF_OUTPUT_SCHEMAS } from "@/lib/ai/brief-output-schemas";
import { ON_PAGE_OUTPUT_SCHEMAS } from "@/lib/ai/on-page-output-schemas";
import { LONG_FORM_OUTPUT_SCHEMAS } from "@/lib/ai/long-form-output-schemas";
import { COMPETITOR_OUTPUT_SCHEMAS } from "@/lib/ai/competitor-output-schemas";
import { KEYWORD_OUTPUT_SCHEMAS } from "@/lib/ai/keyword-output-schemas";
import { ADVERTISING_PLAN_OUTPUT_SCHEMAS } from "@/lib/ai/advertising-plan-output-schemas";
import { ADVERTISING_CREATIVE_OUTPUT_SCHEMAS } from "@/lib/ai/advertising-creative-output-schemas";
import { ADVERTISING_AUDIENCE_OUTPUT_SCHEMAS } from "@/lib/ai/advertising-audience-output-schemas";
import { CONTENT_OUTPUT_SCHEMAS } from "@/lib/ai/content-output-schemas";
import { COMPLIANCE_OUTPUT_SCHEMAS } from "@/lib/ai/compliance-output-schemas";
import { GROWTH_OUTPUT_SCHEMAS } from "@/lib/ai/growth-output-schemas";
import { LEADS_OUTPUT_SCHEMAS } from "@/lib/ai/leads-output-schemas";
import { SOCIAL_REPORT_OUTPUT_SCHEMAS } from "@/lib/ai/social-report-output-schemas";
import { INBOX_OUTPUT_SCHEMAS } from "@/lib/ai/inbox-output-schemas";
import { AGENT_OUTPUT_SCHEMAS } from "@/lib/agent-platform/output-schemas";
import {
  AI_MAX_INPUT_CHARACTERS,
  AI_MAX_OUTPUT_TOKENS_DEFAULT,
  AI_MAX_RETRIES,
  AI_REQUEST_TIMEOUT_MS,
  AI_ALLOWED_PURPOSES,
} from "@/lib/ai/constants";
import { serialiseBrandContext, type BrandContextPayload } from "@/lib/ai/context-builder";
import {
  assertOrganisationDailyBudget,
  assertRequestTokenBudget,
  assertUserDailyBudget,
} from "@/lib/ai/cost-controls";
import { aiErrorMapper } from "@/lib/ai/error-mapper";
import { aiModelRegistry, estimateTokenCostUsd } from "@/lib/ai/model-registry";
import { detectPromptInjection, sanitiseUserInput } from "@/lib/ai/prompt-injection";
import { getAIProvider } from "@/lib/ai/providers";
import { createSensitiveDataRedactor } from "@/lib/ai/redaction";
import { aiResponseParser } from "@/lib/ai/response-parser";
import { createTenantRateLimiter } from "@/lib/ai/rate-limit";
import type { AIExecutionInput, AIExecutionResult } from "@/lib/ai/types";
import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";
import { assertOrganisationScope, type TenantContext } from "@/lib/tenancy/context";
import { aiUsageRecorder } from "@/server/services/ai-usage-recorder";
import { promptTemplateService } from "@/server/services/prompt-template-service";

const OUTPUT_SCHEMAS = {
  ...CONTENT_OUTPUT_SCHEMAS,
  ...GROWTH_OUTPUT_SCHEMAS,
  ...LEADS_OUTPUT_SCHEMAS,
  ...SOCIAL_REPORT_OUTPUT_SCHEMAS,
  ...ANALYST_OUTPUT_SCHEMAS,
  ...KEYWORD_OUTPUT_SCHEMAS,
  ...COMPETITOR_OUTPUT_SCHEMAS,
  ...TOPIC_OUTPUT_SCHEMAS,
  ...BRIEF_OUTPUT_SCHEMAS,
  ...LONG_FORM_OUTPUT_SCHEMAS,
  ...ON_PAGE_OUTPUT_SCHEMAS,
  ...ADVERTISING_PLAN_OUTPUT_SCHEMAS,
  ...ADVERTISING_CREATIVE_OUTPUT_SCHEMAS,
  ...ADVERTISING_AUDIENCE_OUTPUT_SCHEMAS,
  ...COMPLIANCE_OUTPUT_SCHEMAS,
  ...INBOX_OUTPUT_SCHEMAS,
  ...AGENT_OUTPUT_SCHEMAS,
  "diagnostics.ping": z.object({
    ok: z.boolean(),
    message: z.string(),
  }),
  "diagnostics.structured": z.object({
    ok: z.boolean(),
    provider: z.string(),
    latencyCategory: z.enum(["fast", "normal", "slow"]),
  }),
} as const;

type OutputSchemaKey = keyof typeof OUTPUT_SCHEMAS;

function estimateTokensFromText(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

async function withTimeout<T>(
  operation: () => Promise<T>,
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<T> {
  const controller = new AbortController();
  const abortFromParent = () => controller.abort();
  signal?.addEventListener("abort", abortFromParent, { once: true });

  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await operation();
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", abortFromParent);
  }
}

export const aiRequestService = {
  async executeText(
    input: AIExecutionInput,
    context: TenantContext,
  ): Promise<AIExecutionResult<string>> {
    const result = await this.execute(input, context, "text");
    return { ...result, output: String(result.output) };
  },

  async executeStructured<K extends OutputSchemaKey>(
    input: AIExecutionInput & { schemaKey: K },
    context: TenantContext,
  ): Promise<AIExecutionResult<z.infer<(typeof OUTPUT_SCHEMAS)[K]>>> {
    return this.execute(input, context, "structured", input.schemaKey) as Promise<
      AIExecutionResult<z.infer<(typeof OUTPUT_SCHEMAS)[K]>>
    >;
  },

  async execute<K extends OutputSchemaKey>(
    input: AIExecutionInput,
    context: TenantContext,
    mode: "text" | "structured",
    schemaKey?: K,
  ): Promise<AIExecutionResult<unknown>> {
    assertOrganisationScope(input.organisationId, context);

    if (!AI_ALLOWED_PURPOSES.includes(input.purpose)) {
      throw aiErrorMapper.mapValidationError("AI purpose is not allowed.");
    }

    const sanitisedInput = sanitiseUserInput(input.userInput);
    if (!sanitisedInput) {
      throw aiErrorMapper.mapValidationError("User input is required.");
    }
    if (sanitisedInput.length > AI_MAX_INPUT_CHARACTERS) {
      throw aiErrorMapper.mapValidationError("User input exceeds maximum size.");
    }
    if (detectPromptInjection(sanitisedInput)) {
      throw aiErrorMapper.mapValidationError(
        "User input contains disallowed instruction patterns.",
      );
    }

    const redactor = createSensitiveDataRedactor();
    const redactedUserInput = redactor.redact(sanitisedInput);
    const redactedBrandContext = input.brandContext
      ? redactor.redact(serialiseBrandContext(input.brandContext as BrandContextPayload))
      : null;

    const template = await promptTemplateService.getActiveTemplate(input.templateKey);
    const model = aiModelRegistry.resolveModel(input.provider, input.model);
    if (!aiModelRegistry.isModelAllowed(model.provider, model.modelId)) {
      throw aiErrorMapper.mapValidationError("Selected model is not allowed.");
    }

    const estimatedPromptTokens =
      estimateTokensFromText(template.activeVersion!.systemPrompt) +
      estimateTokensFromText(redactedUserInput.text) +
      estimateTokensFromText(redactedBrandContext?.text ?? "");

    await assertRequestTokenBudget(estimatedPromptTokens + AI_MAX_OUTPUT_TOKENS_DEFAULT);
    await assertOrganisationDailyBudget(input.organisationId);
    await assertUserDailyBudget(input.userProfileId);

    const rateLimiter = createTenantRateLimiter();
    const rateLimit = await rateLimiter.check(
      `ai:${input.organisationId}:${input.userProfileId}`,
      60,
      60_000,
    );
    if (!rateLimit.allowed) {
      throw new AppError("RATE_LIMITED", "AI request rate limit exceeded.");
    }

    const aiRequest = await prisma.aIRequest.create({
      data: {
        organisationId: input.organisationId,
        projectId: input.projectId,
        brandId: input.brandId,
        userProfileId: input.userProfileId,
        purpose: input.purpose,
        provider: model.provider,
        model: model.modelId,
        status: "RUNNING",
        requestId: input.requestId,
        inputDigest: redactedUserInput.digest,
        inputPreview: aiResponseParser.preview(redactedUserInput.text),
        startedAt: new Date(),
      },
    });

    const provider = getAIProvider(model.provider);
    let lastError: unknown;

    for (let attempt = 1; attempt <= AI_MAX_RETRIES + 1; attempt += 1) {
      const execution = await prisma.aIExecution.create({
        data: {
          aiRequestId: aiRequest.id,
          provider: model.provider,
          model: model.modelId,
          status: "RUNNING",
          attemptNumber: attempt,
        },
      });

      try {
        const messages = [
          { role: "system" as const, content: template.activeVersion!.systemPrompt },
          ...(redactedBrandContext
            ? [
                {
                  role: "user" as const,
                  content: `Brand context (read-only):\n${redactedBrandContext.text}`,
                },
              ]
            : []),
          { role: "user" as const, content: redactedUserInput.text },
        ];

        const response = await withTimeout(
          async () => {
            if (mode === "structured" && schemaKey) {
              const schema = OUTPUT_SCHEMAS[schemaKey];
              return provider.generateStructured({
                model: model.modelId,
                messages,
                maxOutputTokens: Math.min(AI_MAX_OUTPUT_TOKENS_DEFAULT, model.maxOutputTokens),
                schema,
                schemaName: schemaKey,
                signal: input.signal,
              });
            }

            return provider.generateText({
              model: model.modelId,
              messages,
              maxOutputTokens: Math.min(AI_MAX_OUTPUT_TOKENS_DEFAULT, model.maxOutputTokens),
              signal: input.signal,
            });
          },
          AI_REQUEST_TIMEOUT_MS,
          input.signal,
        );

        const textOutput =
          "data" in response ? JSON.stringify(response.data) : aiResponseParser.parseText(response);
        const usage = response.usage;
        const estimatedCostUsd = estimateTokenCostUsd(model, usage);

        await prisma.aIExecution.update({
          where: { id: execution.id },
          data: {
            status: "COMPLETED",
            latencyMs: response.latencyMs,
            promptTokens: usage.promptTokens,
            completionTokens: usage.completionTokens,
            totalTokens: usage.totalTokens,
            estimatedCostUsd,
            outputDigest: aiResponseParser.digest(textOutput),
            outputPreview: aiResponseParser.preview(textOutput),
            structuredOutput:
              "data" in response ? (response.data as Prisma.InputJsonValue) : undefined,
            completedAt: new Date(),
          },
        });

        await prisma.aIRequest.update({
          where: { id: aiRequest.id },
          data: {
            status: "COMPLETED",
            promptTokens: usage.promptTokens,
            completionTokens: usage.completionTokens,
            totalTokens: usage.totalTokens,
            estimatedCostUsd,
            latencyMs: response.latencyMs,
            completedAt: new Date(),
          },
        });

        await aiUsageRecorder.record({
          organisationId: input.organisationId,
          projectId: input.projectId,
          userProfileId: input.userProfileId,
          aiRequestId: aiRequest.id,
          aiExecutionId: execution.id,
          provider: model.provider,
          model: model.modelId,
          purpose: input.purpose,
          usage,
        });

        return {
          requestId: input.requestId ?? aiRequest.id,
          aiRequestId: aiRequest.id,
          executionId: execution.id,
          output: "data" in response ? response.data : textOutput,
          usage,
          estimatedCostUsd,
          latencyMs: response.latencyMs,
          provider: model.provider,
          model: model.modelId,
        };
      } catch (error) {
        lastError = error;
        const providerError =
          error && typeof error === "object" && "category" in error
            ? (error as { category: string; message: string; retryable?: boolean })
            : {
                category: "UNKNOWN",
                message: error instanceof Error ? error.message : "Unknown error",
                retryable: false,
              };

        await prisma.aIExecution.update({
          where: { id: execution.id },
          data: {
            status: providerError.category === "TIMEOUT" ? "TIMEOUT" : "FAILED",
            errorCategory: aiErrorMapper.toErrorCategory(providerError as never),
            errorMessage: providerError.message,
            completedAt: new Date(),
          },
        });

        if (!providerError.retryable || attempt > AI_MAX_RETRIES) {
          break;
        }
      }
    }

    await prisma.aIRequest.update({
      where: { id: aiRequest.id },
      data: {
        status: "FAILED",
        errorCategory:
          lastError && typeof lastError === "object" && "category" in lastError
            ? aiErrorMapper.toErrorCategory(lastError as never)
            : "UNKNOWN",
        completedAt: new Date(),
      },
    });

    if (lastError && typeof lastError === "object" && "category" in lastError) {
      throw aiErrorMapper.mapProviderError(lastError as never);
    }

    throw new AppError("INTERNAL_ERROR", "AI request failed.", { expose: false });
  },
};
