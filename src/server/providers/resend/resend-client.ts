import { getProviderRequestTimeoutMs } from "@/lib/providers/execution-policy";
import { mapResendHttpError } from "@/server/providers/resend/resend-errors";
import type {
  ResendApiErrorBody,
  ResendDomainListResponse,
  ResendSendEmailPayload,
  ResendSendEmailResponse,
} from "@/server/providers/resend/resend-types";
import { RESEND_API_BASE_URL } from "@/server/providers/resend/resend-types";

export type ResendClientOptions = {
  apiKey: string;
  correlationId?: string;
};

export type ResendRequestResult<T> = {
  data: T;
  status: number;
  retryAfterMs?: number;
};

export class ResendClientError extends Error {
  readonly normalized;
  readonly retryAfterMs?: number;

  constructor(normalized: ReturnType<typeof mapResendHttpError>, retryAfterMs?: number) {
    super(normalized.message);
    this.name = "ResendClientError";
    this.normalized = normalized;
    this.retryAfterMs = retryAfterMs;
  }
}

async function parseJsonSafe(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export function createResendClient(options: ResendClientOptions) {
  const { apiKey, correlationId } = options;

  async function request<T>(
    method: string,
    path: string,
    body?: unknown,
    extraHeaders?: Record<string, string>,
  ): Promise<ResendRequestResult<T>> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), getProviderRequestTimeoutMs());

    try {
      const response = await fetch(`${RESEND_API_BASE_URL}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "User-Agent": "cresco-marketing-intelligence/1.0",
          ...(correlationId ? { "X-Correlation-Id": correlationId } : {}),
          ...extraHeaders,
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      const payload = await parseJsonSafe(response);
      const retryAfterHeader = response.headers.get("retry-after");
      const retryAfterMs = retryAfterHeader ? Number(retryAfterHeader) * 1000 : undefined;

      if (!response.ok) {
        const errorBody = (payload ?? {}) as ResendApiErrorBody;
        throw new ResendClientError(mapResendHttpError(response.status, errorBody), retryAfterMs);
      }

      return { data: payload as T, status: response.status, retryAfterMs };
    } catch (error) {
      if (error instanceof ResendClientError) throw error;
      if (error instanceof Error && error.name === "AbortError") {
        throw new ResendClientError({
          code: "NETWORK_ERROR",
          message: "Resend request timed out.",
          retryable: true,
        });
      }
      throw new ResendClientError({
        code: "NETWORK_ERROR",
        message: error instanceof Error ? error.message : "Network error contacting Resend.",
        retryable: true,
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  return {
    listDomains() {
      return request<ResendDomainListResponse>("GET", "/domains");
    },

    sendEmail(payload: ResendSendEmailPayload, idempotencyKey?: string) {
      const headers: Record<string, string> = {};
      if (idempotencyKey) {
        headers["Idempotency-Key"] = idempotencyKey;
      }
      return request<ResendSendEmailResponse>("POST", "/emails", payload, headers);
    },

    sendBatch(emails: ResendSendEmailPayload[]) {
      return request<Array<{ id: string }>>("POST", "/emails/batch", emails);
    },
  };
}

export type ResendClient = ReturnType<typeof createResendClient>;
