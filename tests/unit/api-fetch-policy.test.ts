import { describe, expect, it } from "vitest";
import {
  DEFAULT_API_FETCH_RETRY_POLICY,
  isRetryableHttpStatus,
  retryDelayMs,
  shouldRetryApiRequest,
} from "@/lib/api/fetch-policy";

describe("api fetch policy", () => {
  it("retries transient 5xx and network failures only", () => {
    expect(shouldRetryApiRequest(500)).toBe(true);
    expect(shouldRetryApiRequest(503)).toBe(true);
    expect(shouldRetryApiRequest(null)).toBe(true);
    expect(shouldRetryApiRequest(401)).toBe(false);
    expect(shouldRetryApiRequest(403)).toBe(false);
    expect(shouldRetryApiRequest(404)).toBe(false);
    expect(shouldRetryApiRequest(400)).toBe(false);
    expect(shouldRetryApiRequest(429)).toBe(true);
  });

  it("uses bounded exponential backoff", () => {
    expect(retryDelayMs(1, DEFAULT_API_FETCH_RETRY_POLICY)).toBe(400);
    expect(retryDelayMs(2, DEFAULT_API_FETCH_RETRY_POLICY)).toBe(800);
    expect(retryDelayMs(5, DEFAULT_API_FETCH_RETRY_POLICY)).toBe(
      DEFAULT_API_FETCH_RETRY_POLICY.maxDelayMs,
    );
  });

  it("classifies retryable HTTP statuses", () => {
    expect(isRetryableHttpStatus(500)).toBe(true);
    expect(isRetryableHttpStatus(404)).toBe(false);
  });
});
