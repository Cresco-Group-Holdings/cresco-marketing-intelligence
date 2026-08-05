export type AppErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "TENANT_CONTEXT_REQUIRED"
  | "ORGANISATION_MEMBERSHIP_REQUIRED"
  | "INSUFFICIENT_ROLE"
  | "RATE_LIMITED"
  | "CONFLICT"
  | "AUTH_CONFIGURATION_ERROR"
  | "AUTH_PROVIDER_UNAVAILABLE"
  | "PROFILE_PROVISIONING_FAILED"
  | "INTERNAL_ERROR"
  | "PLAN_LIMIT_EXCEEDED"
  | "FEATURE_NOT_INCLUDED"
  | "SUBSCRIPTION_INACTIVE"
  | "PAYMENT_ACTION_REQUIRED"
  | "TRIAL_EXPIRED";

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly status: number;
  readonly expose: boolean;

  constructor(
    code: AppErrorCode,
    message: string,
    options?: { status?: number; expose?: boolean; cause?: unknown },
  ) {
    super(message, { cause: options?.cause });
    this.name = "AppError";
    this.code = code;
    this.status = options?.status ?? mapCodeToStatus(code);
    this.expose = options?.expose ?? true;
  }
}

function mapCodeToStatus(code: AppErrorCode): number {
  switch (code) {
    case "UNAUTHORIZED":
      return 401;
    case "FORBIDDEN":
    case "ORGANISATION_MEMBERSHIP_REQUIRED":
    case "INSUFFICIENT_ROLE":
      return 403;
    case "NOT_FOUND":
      return 404;
    case "VALIDATION_ERROR":
    case "TENANT_CONTEXT_REQUIRED":
      return 400;
    case "CONFLICT":
      return 409;
    case "RATE_LIMITED":
    case "PLAN_LIMIT_EXCEEDED":
      return 429;
    case "FEATURE_NOT_INCLUDED":
    case "SUBSCRIPTION_INACTIVE":
    case "TRIAL_EXPIRED":
      return 403;
    case "PAYMENT_ACTION_REQUIRED":
      return 402;
    case "AUTH_CONFIGURATION_ERROR":
    case "AUTH_PROVIDER_UNAVAILABLE":
    case "PROFILE_PROVISIONING_FAILED":
      return 503;
    default:
      return 500;
  }
}

export function toSafeErrorMessage(error: unknown): string {
  if (error instanceof AppError && error.expose) {
    return error.message;
  }

  return "An unexpected error occurred. Please try again.";
}

export function mapErrorToAppError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error;
  }

  return new AppError("INTERNAL_ERROR", "An unexpected error occurred.", {
    expose: false,
    cause: error,
  });
}
