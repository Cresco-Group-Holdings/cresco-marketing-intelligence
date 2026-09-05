import {
  DEFAULT_API_FETCH_RETRY_POLICY,
  retryDelayMs,
  shouldRetryApiRequest,
  sleep,
  type ApiFetchRetryPolicy,
} from "@/lib/api/fetch-policy";
import { dedupeRequest } from "@/lib/api/request-deduper";

export type ApiEnvelope<T> = {
  success: boolean;
  data: T | null;
  meta: Record<string, unknown>;
  error: { code: string; message: string; requestId: string } | null;
};

export class ApiClientError extends Error {
  readonly status: number | null;
  readonly code: string | null;
  readonly requestId: string | null;
  readonly retryable: boolean;

  constructor(
    message: string,
    options?: {
      status?: number | null;
      code?: string | null;
      requestId?: string | null;
      retryable?: boolean;
      cause?: unknown;
    },
  ) {
    super(message, { cause: options?.cause });
    this.name = "ApiClientError";
    this.status = options?.status ?? null;
    this.code = options?.code ?? null;
    this.requestId = options?.requestId ?? null;
    this.retryable = options?.retryable ?? shouldRetryApiRequest(this.status);
  }
}

const SERVICE_UNAVAILABLE_MESSAGE = "The service is temporarily unavailable.";

function isJsonContentType(contentType: string | null): boolean {
  if (!contentType) {
    return false;
  }
  const mediaType = contentType.split(";")[0]?.trim().toLowerCase();
  return mediaType === "application/json" || mediaType.endsWith("+json");
}

async function parseApiResponse<T>(response: Response): Promise<ApiEnvelope<T>> {
  const contentType = response.headers.get("content-type");

  if (!isJsonContentType(contentType)) {
    console.error("API response was not JSON.", {
      status: response.status,
      contentType,
      path: response.url,
    });
    throw new ApiClientError(SERVICE_UNAVAILABLE_MESSAGE, {
      status: response.status,
      retryable: shouldRetryApiRequest(response.status),
    });
  }

  try {
    return (await response.json()) as ApiEnvelope<T>;
  } catch (cause) {
    console.error("API response JSON parsing failed.", {
      status: response.status,
      contentType,
      path: response.url,
    });
    throw new ApiClientError(SERVICE_UNAVAILABLE_MESSAGE, {
      status: response.status,
      retryable: shouldRetryApiRequest(response.status),
      cause,
    });
  }
}

export type ApiFetchOptions = RequestInit & {
  organisationId?: string | null;
  projectId?: string | null;
  retry?: boolean | ApiFetchRetryPolicy;
  dedupe?: boolean;
};

async function executeApiFetch<T>(path: string, options?: ApiFetchOptions): Promise<T> {
  const headers = new Headers(options?.headers);
  headers.set("Content-Type", "application/json");
  if (options?.organisationId) {
    headers.set("x-organisation-id", options.organisationId);
  }
  if (options?.projectId) {
    headers.set("x-project-id", options.projectId);
  }

  const response = await fetch(path, {
    ...options,
    headers,
  });

  const body = await parseApiResponse<T>(response);

  if (!body.success || body.data == null) {
    throw new ApiClientError(body.error?.message ?? "Request failed.", {
      status: response.status,
      code: body.error?.code ?? null,
      requestId: body.error?.requestId ?? null,
      retryable: shouldRetryApiRequest(response.status),
    });
  }

  return body.data;
}

export async function apiFetch<T>(path: string, options?: ApiFetchOptions): Promise<T> {
  const retryPolicy =
    options?.retry === false
      ? null
      : options?.retry === true || options?.retry == null
        ? DEFAULT_API_FETCH_RETRY_POLICY
        : options.retry;

  const run = async (): Promise<T> => {
    let lastError: unknown;

    for (let attempt = 1; ; attempt += 1) {
      try {
        return await executeApiFetch<T>(path, options);
      } catch (error) {
        lastError = error;
        const retryable =
          error instanceof ApiClientError ? error.retryable : shouldRetryApiRequest(null);
        const canRetry = retryPolicy != null && retryable && attempt < retryPolicy.maxAttempts;

        if (!canRetry) {
          throw error;
        }

        await sleep(retryDelayMs(attempt, retryPolicy));
      }
    }

    throw lastError;
  };

  if (options?.dedupe === false) {
    return run();
  }

  const method = (options?.method ?? "GET").toUpperCase();
  const dedupeKey = `${method}:${path}:${options?.body ?? ""}`;
  return dedupeRequest(dedupeKey, run);
}

export async function apiUpload<T>(
  path: string,
  formData: FormData,
  options?: {
    organisationId?: string | null;
    projectId?: string | null;
    retry?: boolean | ApiFetchRetryPolicy;
  },
): Promise<T> {
  const headers = new Headers();
  if (options?.organisationId) {
    headers.set("x-organisation-id", options.organisationId);
  }
  if (options?.projectId) {
    headers.set("x-project-id", options.projectId);
  }

  const retryPolicy =
    options?.retry === false
      ? null
      : options?.retry === true || options?.retry == null
        ? DEFAULT_API_FETCH_RETRY_POLICY
        : options.retry;

  let lastError: unknown;

  for (let attempt = 1; ; attempt += 1) {
    try {
      const response = await fetch(path, {
        method: "POST",
        body: formData,
        headers,
      });

      const body = await parseApiResponse<T>(response);
      if (!body.success || body.data == null) {
        throw new ApiClientError(body.error?.message ?? "Upload failed.", {
          status: response.status,
          code: body.error?.code ?? null,
          requestId: body.error?.requestId ?? null,
          retryable: shouldRetryApiRequest(response.status),
        });
      }

      return body.data;
    } catch (error) {
      lastError = error;
      const retryable =
        error instanceof ApiClientError ? error.retryable : shouldRetryApiRequest(null);
      const canRetry = retryPolicy != null && retryable && attempt < retryPolicy.maxAttempts;

      if (!canRetry) {
        throw error;
      }

      await sleep(retryDelayMs(attempt, retryPolicy));
    }
  }

  throw lastError;
}
