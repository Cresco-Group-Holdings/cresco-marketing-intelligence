import type {
  PlatformProviderAdapter,
  ProviderConnectionHealth,
  ProviderExecutionContext,
  ProviderOperation,
  ProviderOperationResult,
  ProviderValidationResult,
} from "@/lib/providers/platform-adapter";
import { MOCK_SOCIAL_CAPABILITIES } from "@/lib/providers/capability-registry";

const publishedPosts = new Map<string, { status: string; permalink?: string }>();

export function createMockSocialAdapter(): PlatformProviderAdapter {
  return {
    providerKey: "mock-social",
    apiVersion: "1.0-test",

    getCapabilities() {
      return MOCK_SOCIAL_CAPABILITIES.map((key) => ({
        key,
        direction: key.includes("PUBLISH") ? ("WRITE" as const) : ("READ" as const),
        resourceType: key.split("_").slice(1).join("_").toLowerCase(),
      }));
    },

    async validateConfiguration(): Promise<ProviderValidationResult> {
      return { valid: true, errors: [] };
    },

    async verifyConnection(): Promise<ProviderConnectionHealth> {
      return {
        status: "HEALTHY",
        checkedAt: new Date().toISOString(),
        capabilitiesAvailable: [...MOCK_SOCIAL_CAPABILITIES],
        capabilitiesUnavailable: [],
        warnings: [{ code: "TEST_ADAPTER", message: "Non-production social publishing reference adapter." }],
      };
    },

    async execute<TInput, TOutput>(
      operation: ProviderOperation<TInput>,
      context: ProviderExecutionContext,
    ): Promise<ProviderOperationResult<TOutput>> {
      const input = operation.input as {
        dryRun?: boolean;
        destinationId?: string;
        scheduledFor?: string;
        idempotencyKey?: string;
      };

      if (input.dryRun) {
        return { success: true, data: { validated: true, preview: true } as TOutput };
      }

      const token = await context.decryptCredential("API_KEY");
      if (token === "expired-token") {
        return {
          success: false,
          errorCode: "PROVIDER_AUTH_FAILED",
          errorMessageSafe: "Connection expired.",
          retryable: false,
        };
      }

      const idempotencyKey = operation.idempotencyKey ?? input.idempotencyKey;
      if (idempotencyKey && publishedPosts.has(idempotencyKey)) {
        const existing = publishedPosts.get(idempotencyKey)!;
        return {
          success: true,
          data: {
            externalPublicationId: idempotencyKey,
            permalink: existing.permalink,
            status: existing.status,
            duplicate: true,
          } as TOutput,
        };
      }

      switch (operation.operation) {
        case "publishPost":
        case "schedulePost": {
          const externalId = `mock-post-${crypto.randomUUID()}`;
          const status = operation.operation === "schedulePost" ? "SCHEDULED" : "PUBLISHED";
          const permalink = `https://mock-social.test/posts/${externalId}`;
          if (idempotencyKey) {
            publishedPosts.set(idempotencyKey, { status, permalink });
          }
          return {
            success: true,
            data: { externalPublicationId: externalId, permalink, status } as TOutput,
          };
        }
        case "cancelScheduledPost":
          return { success: true, data: { status: "CANCELLED" } as TOutput };
        case "getPublicationStatus":
          return { success: true, data: { status: "PUBLISHED" } as TOutput };
        default:
          return {
            success: false,
            errorCode: "PROVIDER_CAPABILITY_UNSUPPORTED",
            errorMessageSafe: `Unsupported operation: ${operation.operation}`,
            retryable: false,
          };
      }
    },
  };
}

export function resetMockSocialAdapterState() {
  publishedPosts.clear();
}
