import { v4 as uuidv4 } from "uuid";
import { NextResponse } from "next/server";
import { AppError, mapErrorToAppError, toSafeErrorMessage } from "@/lib/errors";
import { logger } from "@/lib/logging";
import { getErrorMonitor } from "@/lib/observability/error-monitor";

export type ApiErrorPayload = {
  code: string;
  message: string;
  requestId: string;
};

export type ApiResponseEnvelope<T> = {
  success: boolean;
  data: T | null;
  meta: Record<string, unknown>;
  error: ApiErrorPayload | null;
};

export function createRequestId(): string {
  return uuidv4();
}

export function apiSuccess<T>(
  data: T,
  meta: Record<string, unknown> = {},
  init?: ResponseInit,
): NextResponse<ApiResponseEnvelope<T>> {
  return NextResponse.json(
    {
      success: true,
      data,
      meta,
      error: null,
    },
    init,
  );
}

export function apiFailure(
  error: AppError,
  requestId: string,
  meta: Record<string, unknown> = {},
  init?: ResponseInit,
): NextResponse<ApiResponseEnvelope<null>> {
  return NextResponse.json(
    {
      success: false,
      data: null,
      meta,
      error: {
        code: error.code,
        message: toSafeErrorMessage(error),
        requestId,
      },
    },
    { status: error.status, ...init },
  );
}

export function handleApiError(
  error: unknown,
  requestId: string,
): NextResponse<ApiResponseEnvelope<null>> {
  const appError = mapErrorToAppError(error);

  logger.error("API request failed", {
    requestId,
    code: appError.code,
    message: appError.message,
    expose: appError.expose,
  });

  getErrorMonitor().captureException(error, {
    requestId,
    component: "api",
    metadata: { code: appError.code, expose: appError.expose },
  });

  return apiFailure(appError, requestId);
}
