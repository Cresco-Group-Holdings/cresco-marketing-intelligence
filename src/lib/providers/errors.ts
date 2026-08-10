export const PROVIDER_ERROR_CODES = {
  PROVIDER_NOT_FOUND: "PROVIDER_NOT_FOUND",
  PROVIDER_CAPABILITY_UNSUPPORTED: "PROVIDER_CAPABILITY_UNSUPPORTED",
  PROVIDER_CONNECTION_NOT_FOUND: "PROVIDER_CONNECTION_NOT_FOUND",
  PROVIDER_CONNECTION_EXPIRED: "PROVIDER_CONNECTION_EXPIRED",
  PROVIDER_ACTION_REQUIRED: "PROVIDER_ACTION_REQUIRED",
  PROVIDER_AUTH_FAILED: "PROVIDER_AUTH_FAILED",
  PROVIDER_PERMISSION_DENIED: "PROVIDER_PERMISSION_DENIED",
  PROVIDER_RATE_LIMITED: "PROVIDER_RATE_LIMITED",
  PROVIDER_TIMEOUT: "PROVIDER_TIMEOUT",
  PROVIDER_UNAVAILABLE: "PROVIDER_UNAVAILABLE",
  PROVIDER_INVALID_REQUEST: "PROVIDER_INVALID_REQUEST",
  PROVIDER_VERSION_UNSUPPORTED: "PROVIDER_VERSION_UNSUPPORTED",
  PROVIDER_RESPONSE_INVALID: "PROVIDER_RESPONSE_INVALID",
  SYNC_ALREADY_RUNNING: "SYNC_ALREADY_RUNNING",
  SYNC_FAILED: "SYNC_FAILED",
  WEBHOOK_SIGNATURE_INVALID: "WEBHOOK_SIGNATURE_INVALID",
} as const;

export type ProviderErrorCode = (typeof PROVIDER_ERROR_CODES)[keyof typeof PROVIDER_ERROR_CODES];

export class ProviderGatewayError extends Error {
  readonly code: ProviderErrorCode;
  readonly safeMessage: string;
  readonly requestId?: string;
  readonly retryable: boolean;

  constructor(input: {
    code: ProviderErrorCode;
    safeMessage: string;
    requestId?: string;
    retryable?: boolean;
    cause?: unknown;
  }) {
    super(input.safeMessage, { cause: input.cause });
    this.name = "ProviderGatewayError";
    this.code = input.code;
    this.safeMessage = input.safeMessage;
    this.requestId = input.requestId;
    this.retryable = input.retryable ?? false;
  }
}

export function mapErrorToProviderCode(error: unknown): ProviderErrorCode {
  if (error instanceof ProviderGatewayError) return error.code;
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  if (message.includes("not found")) return PROVIDER_ERROR_CODES.PROVIDER_CONNECTION_NOT_FOUND;
  if (message.includes("rate limit") || message.includes("429")) return PROVIDER_ERROR_CODES.PROVIDER_RATE_LIMITED;
  if (message.includes("401") || message.includes("auth")) return PROVIDER_ERROR_CODES.PROVIDER_AUTH_FAILED;
  if (message.includes("403") || message.includes("permission")) return PROVIDER_ERROR_CODES.PROVIDER_PERMISSION_DENIED;
  if (message.includes("timeout")) return PROVIDER_ERROR_CODES.PROVIDER_TIMEOUT;
  if (message.includes("unsupported")) return PROVIDER_ERROR_CODES.PROVIDER_CAPABILITY_UNSUPPORTED;
  return PROVIDER_ERROR_CODES.PROVIDER_UNAVAILABLE;
}
