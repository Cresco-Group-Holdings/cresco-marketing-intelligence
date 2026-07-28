import type { AICapability, AIProviderName, AIPurpose } from "@prisma/client";
import type { z } from "zod";

export type AIMessageRole = "system" | "user" | "assistant";

export type AIMessage = {
  role: AIMessageRole;
  content: string;
};

export type AITokenUsage = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
};

export type AIProviderTextRequest = {
  model: string;
  messages: AIMessage[];
  maxOutputTokens?: number;
  temperature?: number;
  signal?: AbortSignal;
};

export type AIProviderTextResponse = {
  content: string;
  usage: AITokenUsage;
  model: string;
  provider: AIProviderName;
  latencyMs: number;
};

export type AIProviderStructuredRequest<TSchema extends z.ZodTypeAny> = AIProviderTextRequest & {
  schema: TSchema;
  schemaName: string;
};

export type AIProviderStructuredResponse<TSchema extends z.ZodTypeAny> = {
  data: z.infer<TSchema>;
  rawContent: string;
  usage: AITokenUsage;
  model: string;
  provider: AIProviderName;
  latencyMs: number;
};

export type AIProviderError = {
  category: "PROVIDER_ERROR" | "RATE_LIMIT" | "TIMEOUT" | "SAFETY_FILTER" | "CONFIGURATION_ERROR" | "UNKNOWN";
  message: string;
  retryable: boolean;
  statusCode?: number;
};

export interface AIProvider {
  readonly name: AIProviderName;
  isConfigured(): boolean;
  generateText(request: AIProviderTextRequest): Promise<AIProviderTextResponse>;
  generateStructured<TSchema extends z.ZodTypeAny>(
    request: AIProviderStructuredRequest<TSchema>,
  ): Promise<AIProviderStructuredResponse<TSchema>>;
}

export type RegisteredAIModel = {
  provider: AIProviderName;
  modelId: string;
  displayName: string;
  capabilities: AICapability[];
  contextTokenLimit: number;
  maxOutputTokens: number;
  inputCostPer1kTokensUsd: number;
  outputCostPer1kTokensUsd: number;
  enabledEnvironments: Array<"development" | "test" | "production">;
  available: boolean;
  fallbackModelId?: string;
};

export type AIExecutionInput = {
  organisationId: string;
  projectId?: string;
  brandId?: string;
  userProfileId: string;
  purpose: AIPurpose;
  provider?: AIProviderName;
  model?: string;
  templateKey: string;
  userInput: string;
  brandContext?: Record<string, unknown>;
  requestId?: string;
  signal?: AbortSignal;
};

export type AIExecutionResult<T = string> = {
  requestId: string;
  aiRequestId: string;
  executionId: string;
  output: T;
  usage: AITokenUsage;
  estimatedCostUsd: number;
  latencyMs: number;
  provider: AIProviderName;
  model: string;
};
