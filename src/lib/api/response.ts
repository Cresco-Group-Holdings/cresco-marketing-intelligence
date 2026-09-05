import { createHash } from "node:crypto";
import { v4 as uuidv4 } from "uuid";
import { NextResponse } from "next/server";
import { AppError, mapErrorToAppError, toSafeErrorMessage } from "@/lib/errors";
import { logger } from "@/lib/logging";
import { getErrorMonitor } from "@/lib/observability/error-monitor";
import { serializeErrorForServerLog } from "@/lib/observability/error-serialization";
import { shouldRetryApiRequest } from "@/lib/api/fetch-policy";

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

export type ApiErrorLogContext = {
  route?: string;
  service?: string;
  organisationId?: string | null;
};

export function createRequestId(): string {
  return uuidv4();
}

function hashOrganisationReference(organisationId?: string | null): string | undefined {
  if (!organisationId) {
    return undefined;
  }

  return createHash("sha256").update(organisationId).digest("hex").slice(0, 12);
}

function classifyApiError(error: unknown, appError: AppError) {
  const serialized = serializeErrorForServerLog(error).error;
  const retryable = shouldRetryApiRequest(appError.status);

  return {
    errorClass: serialized.name,
    errorCode: serialized.code ?? appError.code,
    databaseCode:
      typeof serialized.code === "string" && serialized.code.startsWith("P")
        ? serialized.code
        : undefined,
    retryable,
  };
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
  context: ApiErrorLogContext = {},
): NextResponse<ApiResponseEnvelope<null>> {
  const appError = mapErrorToAppError(error);
  const classification = classifyApiError(error, appError);

  logger.error("API request failed", {
    requestId,
    route: context.route,
    service: context.service,
    organisationRef: hashOrganisationReference(context.organisationId),
    code: appError.code,
    message: appError.message,
    expose: appError.expose,
    errorClass: classification.errorClass,
    databaseCode: classification.databaseCode,
    retryable: classification.retryable,
  });

  getErrorMonitor().captureException(error, {
    requestId,
    organisationId: context.organisationId ?? undefined,
    component: "api",
    metadata: {
      route: context.route,
      service: context.service,
      code: appError.code,
      expose: appError.expose,
      errorClass: classification.errorClass,
      databaseCode: classification.databaseCode,
      retryable: classification.retryable,
    },
  });

  return apiFailure(appError, requestId);
}
