import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiClientError, apiFetch } from "@/lib/api/client";
import { clearDedupedRequests } from "@/lib/api/request-deduper";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("apiFetch retry and dedupe", () => {
  beforeEach(() => {
    clearDedupedRequests();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    clearDedupedRequests();
  });

  it("does not retry deterministic 4xx responses", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        jsonResponse(
          {
            success: false,
            data: null,
            meta: {},
            error: { code: "FORBIDDEN", message: "Denied", requestId: "req-1" },
          },
          403,
        ),
      );

    vi.stubGlobal("fetch", fetchMock);

    await expect(apiFetch("/api/activation", { retry: false })).rejects.toBeInstanceOf(ApiClientError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("bounds 500 retries to the configured attempt limit", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(
        {
          success: false,
          data: null,
          meta: {},
          error: { code: "INTERNAL_ERROR", message: "Boom", requestId: "req-2" },
        },
        500,
      ),
    );

    vi.stubGlobal("fetch", fetchMock);

    await expect(
      apiFetch("/api/activation", {
        retry: { maxAttempts: 3, baseDelayMs: 0, maxDelayMs: 0 },
      }),
    ).rejects.toBeInstanceOf(ApiClientError);

    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("dedupes concurrent GET requests for the same endpoint", async () => {
    let resolveFetch: ((value: Response) => void) | undefined;
    const fetchMock = vi.fn().mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        }),
    );

    vi.stubGlobal("fetch", fetchMock);

    const first = apiFetch<{ activation: { status: string } }>("/api/activation", { retry: false });
    const second = apiFetch<{ activation: { status: string } }>("/api/activation", { retry: false });

    expect(fetchMock).toHaveBeenCalledTimes(1);

    resolveFetch?.(
      jsonResponse({
        success: true,
        data: { activation: { status: "in_progress" } },
        meta: {},
        error: null,
      }),
    );

    const [one, two] = await Promise.all([first, second]);
    expect(one.activation.status).toBe("in_progress");
    expect(two.activation.status).toBe("in_progress");
  });
});
