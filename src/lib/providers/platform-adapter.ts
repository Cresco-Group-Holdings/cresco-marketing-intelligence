import type { CanonicalProviderCapability } from "@/lib/providers/capability-registry";
import type { ProviderConfiguration } from "@/lib/providers/types";

export type ProviderExecutionContext = {
  organisationId: string;
  connectionId: string;
  providerKey: string;
  apiVersion: string;
  configuration: ProviderConfiguration;
  correlationId: string;
  decryptCredential: (type: string) => Promise<string | null>;
};

export type ProviderCapabilityDescriptor = {
  key: CanonicalProviderCapability;
  direction: "READ" | "WRITE" | "BIDIRECTIONAL";
  resourceType: string;
};

export type ProviderValidationResult = {
  valid: boolean;
  errors: string[];
};

export type ProviderConnectionHealth = {
  status: "HEALTHY" | "DEGRADED" | "ACTION_REQUIRED" | "EXPIRED" | "FAILED";
  checkedAt: string;
  capabilitiesAvailable: string[];
  capabilitiesUnavailable: string[];
  warnings: Array<{ code: string; message: string }>;
};

export type ProviderOperation<TInput = unknown> = {
  capability: CanonicalProviderCapability;
  operation: string;
  input: TInput;
  idempotencyKey?: string;
};

export type ProviderOperationResult<TOutput = unknown> = {
  success: boolean;
  data?: TOutput;
  errorCode?: string;
  errorMessageSafe?: string;
  retryable?: boolean;
  rateLimit?: { retryAfterMs?: number; remaining?: number };
};

export type CredentialRefreshResult = {
  refreshed: boolean;
  expiresAt?: string;
};

export type NormalisedWebhookEvent = {
  providerEventId: string;
  eventType: string;
  payloadHash: string;
  receivedAt: string;
  payload: Record<string, unknown>;
};

export type WebhookHandlingResult = {
  status: "PROCESSED" | "IGNORED" | "FAILED";
  errorCode?: string;
};

export interface PlatformProviderAdapter {
  readonly providerKey: string;
  readonly apiVersion: string;

  getCapabilities(): ProviderCapabilityDescriptor[];

  validateConfiguration(context: ProviderExecutionContext): Promise<ProviderValidationResult>;

  verifyConnection(context: ProviderExecutionContext): Promise<ProviderConnectionHealth>;

  execute<TInput, TOutput>(
    operation: ProviderOperation<TInput>,
    context: ProviderExecutionContext,
  ): Promise<ProviderOperationResult<TOutput>>;

  refreshCredentials?(context: ProviderExecutionContext): Promise<CredentialRefreshResult>;

  revokeConnection?(context: ProviderExecutionContext): Promise<void>;

  handleWebhook?(
    event: NormalisedWebhookEvent,
    context: ProviderExecutionContext,
  ): Promise<WebhookHandlingResult>;
}
