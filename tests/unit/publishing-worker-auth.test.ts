import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import {
  isAuthorisedCronRequest,
  isAuthorisedSchedulerRequest,
  isAuthorisedWorkerRequest,
} from "@/lib/api/worker-auth";

function requestWith(headers: Record<string, string> = {}) {
  return new NextRequest("https://app.test/api/publishing-scheduler/process-due", {
    method: "GET",
    headers,
  });
}

describe("publishing worker authorization", () => {
  const originalWorkerToken = process.env.PUBLISHING_WORKER_TOKEN;
  const originalCronSecret = process.env.CRON_SECRET;

  beforeEach(() => {
    process.env.PUBLISHING_WORKER_TOKEN = "worker-secret-token";
    process.env.CRON_SECRET = "cron-secret-token";
  });

  afterEach(() => {
    if (originalWorkerToken === undefined) delete process.env.PUBLISHING_WORKER_TOKEN;
    else process.env.PUBLISHING_WORKER_TOKEN = originalWorkerToken;
    if (originalCronSecret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = originalCronSecret;
  });

  it("accepts a request carrying the configured worker bearer token", () => {
    expect(
      isAuthorisedWorkerRequest(requestWith({ authorization: "Bearer worker-secret-token" })),
    ).toBe(true);
  });

  it("accepts a request carrying the configured cron bearer token", () => {
    expect(
      isAuthorisedCronRequest(requestWith({ authorization: "Bearer cron-secret-token" })),
    ).toBe(true);
  });

  it("accepts scheduler requests authenticated by either worker or cron secret", () => {
    expect(
      isAuthorisedSchedulerRequest(requestWith({ authorization: "Bearer worker-secret-token" })),
    ).toBe(true);
    expect(
      isAuthorisedSchedulerRequest(requestWith({ authorization: "Bearer cron-secret-token" })),
    ).toBe(true);
  });

  it("rejects a request with no authorization header", () => {
    expect(isAuthorisedWorkerRequest(requestWith())).toBe(false);
    expect(isAuthorisedCronRequest(requestWith())).toBe(false);
    expect(isAuthorisedSchedulerRequest(requestWith())).toBe(false);
  });

  it("rejects a request with an incorrect token", () => {
    expect(
      isAuthorisedWorkerRequest(requestWith({ authorization: "Bearer wrong-token-value" })),
    ).toBe(false);
    expect(
      isAuthorisedCronRequest(requestWith({ authorization: "Bearer wrong-token-value" })),
    ).toBe(false);
  });

  it("rejects a non-bearer authorization scheme", () => {
    expect(
      isAuthorisedWorkerRequest(requestWith({ authorization: "Basic worker-secret-token" })),
    ).toBe(false);
  });

  it("rejects every request when no worker token is configured", () => {
    delete process.env.PUBLISHING_WORKER_TOKEN;
    expect(
      isAuthorisedWorkerRequest(requestWith({ authorization: "Bearer worker-secret-token" })),
    ).toBe(false);
    expect(
      isAuthorisedSchedulerRequest(requestWith({ authorization: "Bearer cron-secret-token" })),
    ).toBe(true);
  });

  it("rejects cron requests when CRON_SECRET is unset", () => {
    delete process.env.CRON_SECRET;
    expect(
      isAuthorisedCronRequest(requestWith({ authorization: "Bearer cron-secret-token" })),
    ).toBe(false);
  });
});
