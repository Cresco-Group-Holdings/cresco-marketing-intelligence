import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/errors";
import { handleApiError } from "@/lib/api/response";
import { getErrorMonitor, resetErrorMonitorForTests } from "@/lib/observability/error-monitor";
import { serializeErrorForServerLog } from "@/lib/observability/error-serialization";

describe("error serialization", () => {
  it("serializes AuthApiError-like errors with code and status", () => {
    const authError = Object.assign(new Error("Signups not allowed for this instance"), {
      name: "AuthApiError",
      code: "signup_disabled",
      status: 400,
    });

    const { error } = serializeErrorForServerLog(authError);

    expect(error).toEqual({
      name: "AuthApiError",
      message: "Signups not allowed for this instance",
      code: "signup_disabled",
      status: 400,
      stack: expect.any(String),
    });
  });

  it("serializes AuthRetryableFetchError with nested cause", () => {
    const fetchCause = new Error("fetch failed");
    const retryableError = Object.assign(new Error("fetch failed"), {
      name: "AuthRetryableFetchError",
      cause: fetchCause,
    });

    const { error } = serializeErrorForServerLog(retryableError);

    expect(error.name).toBe("AuthRetryableFetchError");
    expect(error.message).toBe("fetch failed");
    expect(error.cause).toEqual({
      name: "Error",
      message: "fetch failed",
      stack: expect.any(String),
    });
  });

  it("serializes AppError with original Supabase cause", () => {
    const authError = Object.assign(new Error("Signups not allowed for this instance"), {
      name: "AuthApiError",
      code: "signup_disabled",
      status: 400,
    });

    const appError = new AppError(
      "AUTH_PROVIDER_UNAVAILABLE",
      "The registration service is temporarily unavailable.",
      { status: 503, expose: true, cause: authError },
    );

    const { error } = serializeErrorForServerLog(appError);

    expect(error).toMatchObject({
      name: "AppError",
      code: "AUTH_PROVIDER_UNAVAILABLE",
      message: "The registration service is temporarily unavailable.",
      status: 503,
      cause: {
        name: "AuthApiError",
        code: "signup_disabled",
        message: "Signups not allowed for this instance",
        status: 400,
      },
    });
  });
});

describe("error monitor", () => {
  const originalError = console.error;

  beforeEach(() => {
    resetErrorMonitorForTests();
    console.error = vi.fn();
  });

  afterEach(() => {
    console.error = originalError;
  });

  it("logs full error and cause details for wrapped signup failures", () => {
    const authError = Object.assign(new Error("Signups not allowed for this instance"), {
      name: "AuthApiError",
      code: "signup_disabled",
      status: 400,
    });
    const appError = new AppError(
      "AUTH_PROVIDER_UNAVAILABLE",
      "The registration service is temporarily unavailable.",
      { status: 503, expose: true, cause: authError },
    );

    getErrorMonitor().captureException(appError, {
      requestId: "req-signup-1",
      component: "api",
      metadata: { code: "AUTH_PROVIDER_UNAVAILABLE", expose: true },
    });

    expect(console.error).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(String(vi.mocked(console.error).mock.calls[0]?.[0]));

    expect(payload.channel).toBe("error.monitor.exception");
    expect(payload.requestId).toBe("req-signup-1");
    expect(payload.error).toMatchObject({
      name: "AppError",
      code: "AUTH_PROVIDER_UNAVAILABLE",
      message: "The registration service is temporarily unavailable.",
      status: 503,
    });
    expect(payload.cause).toMatchObject({
      name: "AuthApiError",
      code: "signup_disabled",
      message: "Signups not allowed for this instance",
      status: 400,
    });
    expect(payload.error.stack).toContain("error-monitor.test.ts");
  });

  it("logs AuthRetryableFetchError and underlying fetch cause", () => {
    const fetchCause = new Error("fetch failed");
    const retryableError = Object.assign(new Error("fetch failed"), {
      name: "AuthRetryableFetchError",
      cause: fetchCause,
    });

    getErrorMonitor().captureException(retryableError, {
      requestId: "req-fetch-1",
      component: "api",
    });

    const payload = JSON.parse(String(vi.mocked(console.error).mock.calls[0]?.[0]));

    expect(payload.error.name).toBe("AuthRetryableFetchError");
    expect(payload.error.message).toBe("fetch failed");
    expect(payload.cause).toMatchObject({
      name: "Error",
      message: "fetch failed",
    });
  });
});

describe("handleApiError", () => {
  const originalError = console.error;

  beforeEach(() => {
    resetErrorMonitorForTests();
    console.error = vi.fn();
  });

  afterEach(() => {
    console.error = originalError;
  });

  it("keeps client response generic while logging original cause server-side", async () => {
    const authError = Object.assign(new Error("Signups not allowed for this instance"), {
      name: "AuthApiError",
      code: "signup_disabled",
      status: 400,
    });
    const appError = new AppError(
      "AUTH_PROVIDER_UNAVAILABLE",
      "The registration service is temporarily unavailable.",
      { status: 503, expose: true, cause: authError },
    );

    const response = handleApiError(appError, "req-client-1");
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.error).toEqual({
      code: "AUTH_PROVIDER_UNAVAILABLE",
      message: "The registration service is temporarily unavailable.",
      requestId: "req-client-1",
    });
    expect(body.error.message).not.toContain("signup_disabled");

    const monitorPayload = JSON.parse(
      String(
        vi
          .mocked(console.error)
          .mock.calls.find((call) => String(call[0]).includes("error.monitor.exception"))?.[0],
      ),
    );

    expect(monitorPayload.cause).toMatchObject({
      name: "AuthApiError",
      code: "signup_disabled",
      message: "Signups not allowed for this instance",
    });
  });
});
