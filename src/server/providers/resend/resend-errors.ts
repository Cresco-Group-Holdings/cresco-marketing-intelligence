import type { ProviderNormalizedError } from "@/lib/providers/types";
import type { ResendApiErrorBody } from "@/server/providers/resend/resend-types";

export type ResendSafeErrorCode =
  | "VALIDATION_ERROR"
  | "AUTHENTICATION_REQUIRED"
  | "INVALID_CREDENTIALS"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "PROVIDER_UNAVAILABLE"
  | "NETWORK_ERROR"
  | "MALFORMED_RESPONSE"
  | "DOMAIN_NOT_VERIFIED"
  | "RECIPIENT_LIMIT_EXCEEDED"
  | "UNKNOWN";

export function mapResendHttpError(status: number, body?: ResendApiErrorBody): ProviderNormalizedError {
  const message = body?.message ?? `Resend API error (${status})`;

  switch (status) {
    case 400:
      return { code: "VALIDATION_ERROR", message, retryable: false, statusCode: status };
    case 401:
      return { code: "AUTHENTICATION_REQUIRED", message, retryable: false, statusCode: status };
    case 403:
      return { code: "INVALID_CREDENTIALS", message, retryable: false, statusCode: status };
    case 404:
      return { code: "NOT_FOUND", message, retryable: false, statusCode: status };
    case 409:
      return { code: "CONFLICT", message, retryable: false, statusCode: status };
    case 422:
      return { code: "VALIDATION_ERROR", message, retryable: false, statusCode: status };
    case 429:
      return { code: "RATE_LIMITED", message, retryable: true, statusCode: status };
    default:
      if (status >= 500) {
        return { code: "PROVIDER_UNAVAILABLE", message, retryable: true, statusCode: status };
      }
      return { code: "UNKNOWN", message, retryable: false, statusCode: status };
  }
}

export function mapResendSafeErrorCode(code: string): ResendSafeErrorCode {
  const allowed: ResendSafeErrorCode[] = [
    "VALIDATION_ERROR",
    "AUTHENTICATION_REQUIRED",
    "INVALID_CREDENTIALS",
    "FORBIDDEN",
    "NOT_FOUND",
    "CONFLICT",
    "RATE_LIMITED",
    "PROVIDER_UNAVAILABLE",
    "NETWORK_ERROR",
    "MALFORMED_RESPONSE",
    "DOMAIN_NOT_VERIFIED",
    "RECIPIENT_LIMIT_EXCEEDED",
    "UNKNOWN",
  ];
  return allowed.includes(code as ResendSafeErrorCode) ? (code as ResendSafeErrorCode) : "UNKNOWN";
}
