import type {
  ApiKeyProviderAdapter,
  EmailProviderAdapter,
  ProviderAdapterContext,
  WebhookProviderAdapter,
} from "@/lib/providers/adapter-contracts";
import type {
  EmailSendRequest,
  EmailSendResult,
  VerifiedDomainInfo,
} from "@/lib/providers/email-types";
import { EMAIL_BATCH_MAX_SIZE, EMAIL_SEND_MAX_RECIPIENTS } from "@/lib/providers/email-types";
import type { ProviderConfiguration, ProviderHealthResult, ProviderTestResult } from "@/lib/providers/types";
import type { ProviderCapabilityType } from "@prisma/client";
import { createResendClient, ResendClientError } from "@/server/providers/resend/resend-client";
import { extractDomainFromAddress, isDomainSendingEligible, listResendVerifiedDomains } from "@/server/providers/resend/resend-domain-service";
import { mapResendSafeErrorCode } from "@/server/providers/resend/resend-errors";
import { normalizeResendWebhookEvent } from "@/server/providers/resend/resend-normalizer";
import type { ResendSendEmailPayload, ResendWebhookPayload } from "@/server/providers/resend/resend-types";
import { RESEND_API_KEY_PATTERN } from "@/server/providers/resend/resend-types";
import {
  extractResendWebhookEventId,
  parseResendWebhookPayload,
  verifyResendWebhookSignature,
} from "@/server/providers/resend/resend-webhook";

const CAPABILITIES: ProviderCapabilityType[] = [
  "EMAIL_SEND",
  "EMAIL_BATCH_SEND",
  "EMAIL_DELIVERY_EVENTS",
  "EMAIL_DOMAIN_STATUS",
  "WEBHOOK_RECEIVE",
  "CONNECTION_TEST",
  "HEALTH_CHECK",
];

function validateEmailRequest(message: EmailSendRequest): string[] {
  const errors: string[] = [];
  if (!message.from?.trim()) errors.push("Sender address is required.");
  if (!message.subject?.trim()) errors.push("Subject is required.");
  if (!message.html?.trim() && !message.text?.trim()) errors.push("HTML or text body is required.");
  if (!message.to?.length) errors.push("At least one recipient is required.");
  if (message.to.length > EMAIL_SEND_MAX_RECIPIENTS) {
    errors.push(`Recipient limit exceeded (max ${EMAIL_SEND_MAX_RECIPIENTS}).`);
  }
  if (!message.idempotencyKey?.trim()) errors.push("Idempotency key is required.");
  return errors;
}

function toResendPayload(message: EmailSendRequest): ResendSendEmailPayload {
  const tags = message.tags
    ? Object.entries(message.tags).map(([name, value]) => ({ name, value }))
    : undefined;

  return {
    from: message.from,
    to: message.to,
    subject: message.subject,
    html: message.html,
    text: message.text,
    cc: message.cc,
    bcc: message.bcc,
    reply_to: message.replyTo,
    headers: message.headers,
    tags,
  };
}

export type ResendAdapterDeps = {
  getApiKey: (context: ProviderAdapterContext) => Promise<string | null>;
  getWebhookSecret?: (context: ProviderAdapterContext) => Promise<string | null>;
};

export function createResendAdapter(deps: ResendAdapterDeps) {
  const adapter = {
    providerKey: "resend" as const,

    validateConfiguration(configuration: ProviderConfiguration) {
      const errors: string[] = [];
      const defaultDomain = configuration.defaultSendingDomain;
      if (defaultDomain !== undefined && typeof defaultDomain !== "string") {
        errors.push("defaultSendingDomain must be a string.");
      }
      return { valid: errors.length === 0, errors };
    },

    getCapabilities() {
      return CAPABILITIES;
    },

    async validateApiKey(apiKey: string): Promise<ProviderTestResult> {
      if (!RESEND_API_KEY_PATTERN.test(apiKey)) {
        return { success: false, message: "Malformed Resend API key.", errorCode: "VALIDATION_ERROR" };
      }
      try {
        const client = createResendClient({ apiKey });
        await client.listDomains();
        return { success: true, message: "API key is valid." };
      } catch (error) {
        if (error instanceof ResendClientError) {
          return {
            success: false,
            message: error.normalized.message,
            errorCode: mapResendSafeErrorCode(error.normalized.code),
          };
        }
        return { success: false, message: "Unable to validate API key.", errorCode: "UNKNOWN" };
      }
    },

    async testConnection(context: ProviderAdapterContext): Promise<ProviderTestResult> {
      const apiKey = await deps.getApiKey(context);
      if (!apiKey) {
        return { success: false, message: "API key not configured.", errorCode: "INVALID_CREDENTIALS" };
      }
      try {
        const domains = await listResendVerifiedDomains(apiKey, context.correlationId);
        const verifiedCount = domains.filter((d) => d.sendingEligible).length;
        return {
          success: true,
          message: `Connected. ${domains.length} domain(s), ${verifiedCount} verified.`,
        };
      } catch (error) {
        if (error instanceof ResendClientError) {
          return {
            success: false,
            message: error.normalized.message,
            errorCode: mapResendSafeErrorCode(error.normalized.code),
          };
        }
        return { success: false, message: "Connection test failed.", errorCode: "UNKNOWN" };
      }
    },

    async getHealth(context: ProviderAdapterContext): Promise<ProviderHealthResult> {
      const test = await adapter.testConnection(context);
      return {
        status: test.success ? "HEALTHY" : "UNHEALTHY",
        message: test.message,
        checkedAt: new Date().toISOString(),
      };
    },

    async listVerifiedDomains(context: ProviderAdapterContext): Promise<VerifiedDomainInfo[]> {
      const apiKey = await deps.getApiKey(context);
      if (!apiKey) return [];
      return listResendVerifiedDomains(apiKey, context.correlationId);
    },

    async sendEmail(input: {
      context: ProviderAdapterContext;
      message: unknown;
      idempotencyKey?: string;
    }): Promise<{ messageId: string }> {
      const message = input.message as EmailSendRequest;
      const result = await adapter.sendEmailInternal({
        context: input.context,
        message,
        idempotencyKey: input.idempotencyKey,
      });
      if (!result.providerMessageId) {
        throw new Error(result.safeErrorCode ?? "SEND_FAILED");
      }
      return { messageId: result.providerMessageId };
    },

    async sendEmailInternal(input: {
      context: ProviderAdapterContext;
      message: EmailSendRequest;
      idempotencyKey?: string;
      verifiedDomains?: VerifiedDomainInfo[];
    }): Promise<EmailSendResult> {
      const validationErrors = validateEmailRequest(input.message);
      if (validationErrors.length > 0) {
        return {
          provider: "resend",
          connectionId: input.context.connectionId,
          accepted: false,
          status: "REJECTED",
          safeErrorCode: "VALIDATION_ERROR",
        };
      }

      const apiKey = await deps.getApiKey(input.context);
      if (!apiKey) {
        return {
          provider: "resend",
          connectionId: input.context.connectionId,
          accepted: false,
          status: "FAILED",
          safeErrorCode: "INVALID_CREDENTIALS",
        };
      }

      const domains = input.verifiedDomains ?? (await listResendVerifiedDomains(apiKey, input.context.correlationId));
      if (!isDomainSendingEligible(domains, input.message.from)) {
        const domain = extractDomainFromAddress(input.message.from);
        const isSandboxDomain = domain === "resend.dev";
        if (!isSandboxDomain && input.message.messageType !== "TEST") {
          return {
            provider: "resend",
            connectionId: input.context.connectionId,
            accepted: false,
            status: "REJECTED",
            safeErrorCode: "DOMAIN_NOT_VERIFIED",
          };
        }
      }

      const client = createResendClient({ apiKey, correlationId: input.context.correlationId });
      const idempotencyKey = input.idempotencyKey ?? input.message.idempotencyKey;

      try {
        const response = await client.sendEmail(toResendPayload(input.message), idempotencyKey);
        return {
          provider: "resend",
          connectionId: input.context.connectionId,
          providerMessageId: response.data.id,
          accepted: true,
          status: "ACCEPTED",
          requestId: input.context.correlationId,
          sentAt: new Date().toISOString(),
        };
      } catch (error) {
        if (error instanceof ResendClientError) {
          return {
            provider: "resend",
            connectionId: input.context.connectionId,
            accepted: false,
            status: "FAILED",
            safeErrorCode: mapResendSafeErrorCode(error.normalized.code),
            requestId: input.context.correlationId,
          };
        }
        return {
          provider: "resend",
          connectionId: input.context.connectionId,
          accepted: false,
          status: "FAILED",
          safeErrorCode: "UNKNOWN",
          requestId: input.context.correlationId,
        };
      }
    },

    async sendBatch(input: {
      context: ProviderAdapterContext;
      messages: EmailSendRequest[];
      verifiedDomains?: VerifiedDomainInfo[];
    }): Promise<EmailSendResult[]> {
      if (input.messages.length > EMAIL_BATCH_MAX_SIZE) {
        return input.messages.map(() => ({
          provider: "resend",
          connectionId: input.context.connectionId,
          accepted: false,
          status: "REJECTED" as const,
          safeErrorCode: "VALIDATION_ERROR",
        }));
      }
      return Promise.all(
        input.messages.map((message) =>
          adapter.sendEmailInternal({
            context: input.context,
            message,
            verifiedDomains: input.verifiedDomains,
          }),
        ),
      );
    },

    async revokeConnection(_context: ProviderAdapterContext): Promise<void> {
      // Local credential revocation handled by provider-credential-service.
    },
  } satisfies ApiKeyProviderAdapter &
    EmailProviderAdapter & {
      listVerifiedDomains(context: ProviderAdapterContext): Promise<VerifiedDomainInfo[]>;
      sendBatch(input: {
        context: ProviderAdapterContext;
        messages: EmailSendRequest[];
        verifiedDomains?: VerifiedDomainInfo[];
      }): Promise<EmailSendResult[]>;
      sendEmailInternal(input: {
        context: ProviderAdapterContext;
        message: EmailSendRequest;
        idempotencyKey?: string;
        verifiedDomains?: VerifiedDomainInfo[];
      }): Promise<EmailSendResult>;
      revokeConnection(context: ProviderAdapterContext): Promise<void>;
    };

  const webhookAdapter: WebhookProviderAdapter = {
    providerKey: "resend",
    verifyWebhookSignature(input) {
      return verifyResendWebhookSignature(input);
    },
    extractEventId(_payload: unknown, headers?: Record<string, string | undefined>) {
      if (headers) {
        return extractResendWebhookEventId(headers);
      }
      return null;
    },
    extractEventType(payload: unknown) {
      if (!payload || typeof payload !== "object") return null;
      const type = (payload as ResendWebhookPayload).type;
      return typeof type === "string" ? type : null;
    },
    normalizeWebhookEvent(payload: unknown) {
      const parsed = payload as ResendWebhookPayload;
      return normalizeResendWebhookEvent(parsed, "unknown") as unknown as Record<string, unknown>;
    },
  };

  return { adapter, webhookAdapter };
}

export type ResendAdapterBundle = ReturnType<typeof createResendAdapter>;

export function parseResendWebhookBody(rawBody: string): ResendWebhookPayload | null {
  return parseResendWebhookPayload(rawBody);
}
