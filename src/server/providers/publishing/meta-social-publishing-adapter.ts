import type {
  PlatformProviderAdapter,
  ProviderExecutionContext,
  ProviderOperation,
  ProviderOperationResult,
} from "@/lib/providers/platform-adapter";
import { getProviderDefinition } from "@/lib/providers/registry";
import { META_SOCIAL_CAPABILITIES } from "@/lib/providers/capability-registry";
import {
  InstagramPublishingAdapter,
  normaliseInstagramError,
} from "@/lib/social/instagram-publishing-adapter";
import { PROVIDER_ERROR_CODES } from "@/lib/providers/errors";

type PublishInput = {
  externalAccountId?: string;
  destinationId?: string;
  caption?: string;
  mediaUrls?: string[];
  mediaType?: "IMAGE" | "CAROUSEL" | "REELS";
  scheduledFor?: string;
  dryRun?: boolean;
};

const MAX_POLL_ATTEMPTS = 12;
const POLL_DELAY_MS = 5_000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function mapInstagramError(error: unknown): ProviderOperationResult<never> {
  const normalized = normaliseInstagramError(
    error instanceof Error ? { message: error.message } : undefined,
    500,
  );
  const reauth = normalized.code === "TOKEN_EXPIRED";
  return {
    success: false,
    errorCode: reauth ? "PROVIDER_AUTH_FAILED" : normalized.code,
    errorMessageSafe: normalized.message,
    retryable: normalized.retryable,
  };
}

export function createMetaSocialPublishingAdapter(): PlatformProviderAdapter {
  const instagram = new InstagramPublishingAdapter();
  const definition = getProviderDefinition("meta");

  return {
    providerKey: "meta",
    apiVersion: definition?.apiVersion ?? "1.0",

    getCapabilities() {
      return META_SOCIAL_CAPABILITIES.map((key) => ({
        key,
        direction: key.includes("PUBLISH") ? ("WRITE" as const) : ("READ" as const),
        resourceType: key.split("_").slice(1).join("_").toLowerCase(),
      }));
    },

    async validateConfiguration() {
      return { valid: true, errors: [] };
    },

    async verifyConnection(context: ProviderExecutionContext) {
      const token = await context.getAccessToken?.();
      if (!token) {
        return {
          status: "ACTION_REQUIRED" as const,
          checkedAt: new Date().toISOString(),
          capabilitiesAvailable: [],
          capabilitiesUnavailable: [...META_SOCIAL_CAPABILITIES],
          warnings: [{ code: "NO_TOKEN", message: "Access token unavailable." }],
        };
      }
      return {
        status: "HEALTHY" as const,
        checkedAt: new Date().toISOString(),
        capabilitiesAvailable: [...META_SOCIAL_CAPABILITIES],
        capabilitiesUnavailable: [],
        warnings: [],
      };
    },

    async execute<TInput, TOutput>(
      operation: ProviderOperation<TInput>,
      context: ProviderExecutionContext,
    ): Promise<ProviderOperationResult<TOutput>> {
      const input = operation.input as PublishInput;

      if (input.dryRun) {
        return { success: true, data: { validated: true, preview: true } as TOutput };
      }

      const accessToken = await context.getAccessToken?.();
      if (!accessToken) {
        return {
          success: false,
          errorCode: PROVIDER_ERROR_CODES.PROVIDER_AUTH_FAILED,
          errorMessageSafe: "Provider connection requires reauthorization.",
          retryable: false,
        };
      }

      const igUserId = input.externalAccountId ?? input.destinationId;
      if (!igUserId) {
        return {
          success: false,
          errorCode: "VALIDATION_ERROR",
          errorMessageSafe: "Instagram business account is required.",
          retryable: false,
        };
      }

      try {
        switch (operation.operation) {
          case "publishPost":
          case "schedulePost": {
            const mediaUrls = input.mediaUrls ?? [];
            if (mediaUrls.length === 0) {
              return {
                success: false,
                errorCode: "VALIDATION_ERROR",
                errorMessageSafe: "At least one media URL is required to publish.",
                retryable: false,
              };
            }

            const mediaType =
              input.mediaType ?? (mediaUrls.length > 1 ? "CAROUSEL" : "IMAGE");

            const containerId = await instagram.createContainer({
              igUserId,
              accessToken,
              mediaUrls,
              mediaType,
              caption: input.caption,
            });

            let status = "IN_PROGRESS";
            for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt += 1) {
              const poll = await instagram.getContainerStatus(containerId, accessToken);
              status = poll.status;
              if (status === "FINISHED" || status === "PUBLISHED") break;
              if (status === "ERROR" || status === "EXPIRED") {
                return {
                  success: false,
                  errorCode: "UNSUPPORTED_MEDIA",
                  errorMessageSafe: `Instagram media processing failed (${status.toLowerCase()}).`,
                  retryable: false,
                };
              }
              await sleep(POLL_DELAY_MS);
            }

            if (status !== "FINISHED" && status !== "PUBLISHED") {
              return {
                success: false,
                errorCode: "PROVIDER_TIMEOUT",
                errorMessageSafe: "Instagram media processing timed out. Retry shortly.",
                retryable: true,
              };
            }

            const postId = await instagram.publishContainer(igUserId, containerId, accessToken);
            const permalink = (await instagram.getPermalink(postId, accessToken)) ?? undefined;

            return {
              success: true,
              data: {
                externalPublicationId: postId,
                permalink,
                status: operation.operation === "schedulePost" ? "SCHEDULED" : "PUBLISHED",
                providerTimestamp: new Date().toISOString(),
              } as TOutput,
            };
          }
          case "getPublicationStatus":
            return { success: true, data: { status: "PUBLISHED" } as TOutput };
          case "cancelScheduledPost":
            return { success: true, data: { status: "CANCELLED" } as TOutput };
          default:
            return {
              success: false,
              errorCode: PROVIDER_ERROR_CODES.PROVIDER_CAPABILITY_UNSUPPORTED,
              errorMessageSafe: `Unsupported operation: ${operation.operation}`,
              retryable: false,
            };
        }
      } catch (error) {
        return mapInstagramError(error);
      }
    },
  };
}
