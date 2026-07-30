import { AppError } from "@/lib/errors";

export function normaliseGscHttpError(status: number, body: unknown): AppError & { retryable: boolean } {
  const message =
    typeof body === "object" &&
    body !== null &&
    "error" in body &&
    typeof (body as { error?: { message?: string } }).error?.message === "string"
      ? (body as { error: { message: string } }).error.message
      : `Search Console API request failed with status ${status}`;

  if (status === 401) {
    return Object.assign(new AppError("UNAUTHORIZED", message), { retryable: false });
  }
  if (status === 403) {
    return Object.assign(new AppError("FORBIDDEN", message), { retryable: false });
  }
  if (status === 404) {
    return Object.assign(new AppError("NOT_FOUND", message), { retryable: false });
  }
  if (status === 429) {
    return Object.assign(new AppError("RATE_LIMITED", message), { retryable: true });
  }
  if (status === 400) {
    return Object.assign(new AppError("VALIDATION_ERROR", message), { retryable: false });
  }
  return Object.assign(new AppError("INTERNAL_ERROR", message), { retryable: status >= 500 });
}
