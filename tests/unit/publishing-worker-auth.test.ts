import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { isAuthorisedWorkerRequest } from "@/lib/api/worker-auth";

function requestWith(headers: Record<string, string> = {}) {
  return new NextRequest("https://app.test/api/publishing-jobs/job-1/process", {
    method: "POST",
    headers,
  });
}

describe("publishing worker authorization", () => {
  const originalToken = process.env.PUBLISHING_WORKER_TOKEN;

  beforeEach(() => {
    process.env.PUBLISHING_WORKER_TOKEN = "worker-secret-token";
  });

  afterEach(() => {
    if (originalToken === undefined) delete process.env.PUBLISHING_WORKER_TOKEN;
    else process.env.PUBLISHING_WORKER_TOKEN = originalToken;
  });

  it("accepts a request carrying the configured bearer token", () => {
    expect(
      isAuthorisedWorkerRequest(requestWith({ authorization: "Bearer worker-secret-token" })),
    ).toBe(true);
  });

  it("rejects a request with no authorization header", () => {
    expect(isAuthorisedWorkerRequest(requestWith())).toBe(false);
  });

  it("rejects a request with an incorrect token", () => {
    expect(
      isAuthorisedWorkerRequest(requestWith({ authorization: "Bearer wrong-token-value" })),
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
  });
});
