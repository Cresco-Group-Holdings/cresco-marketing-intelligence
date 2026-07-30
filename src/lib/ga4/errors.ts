import { AppError } from "@/lib/errors";

export type Ga4ApiError = AppError & {
  statusCode: number;
  retryable: boolean;
};

export function normaliseGa4HttpError(status: number, body: unknown): Ga4ApiError {
  const message =
    typeof body === "object" &&
    body !== null &&
    "error" in body &&
    typeof (body as { error?: { message?: string } }).error?.message === "string"
      ? (body as { error: { message: string } }).error.message
      : `GA4 API request failed with status ${status}`;

  if (status === 401) {
    return Object.assign(new AppError("UNAUTHORIZED", message), {
      statusCode: status,
      retryable: false,
    });
  }
  if (status === 403) {
    return Object.assign(new AppError("FORBIDDEN", message), {
      statusCode: status,
      retryable: false,
    });
  }
  if (status === 404) {
    return Object.assign(new AppError("NOT_FOUND", message), {
      statusCode: status,
      retryable: false,
    });
  }
  if (status === 429) {
    return Object.assign(new AppError("RATE_LIMITED", message), {
      statusCode: status,
      retryable: true,
    });
  }
  if (status === 400) {
    return Object.assign(new AppError("VALIDATION_ERROR", message), {
      statusCode: status,
      retryable: false,
    });
  }
  return Object.assign(new AppError("INTERNAL_ERROR", message), {
    statusCode: status,
    retryable: status >= 500,
  });
}
