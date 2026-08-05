import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { resetRateLimitStoreForTests } from "@/lib/security/rate-limit";
import {
  assertMutatingRequestSecurity,
  resolveRequestId,
  API_MAX_BODY_BYTES,
} from "@/lib/security/api-security";
import { AppError } from "@/lib/errors";

describe("api security", () => {
  beforeEach(() => {
    resetRateLimitStoreForTests();
    process.env.APP_URL = "http://localhost:3000";
  });

  it("resolves request ID from x-request-id header", () => {
    const request = new NextRequest("http://localhost:3000/api/test", {
      headers: { "x-request-id": "req-abc-12345678" },
    });
    expect(resolveRequestId(request)).toBe("req-abc-12345678");
  });

  it("generates a new request ID when header is missing", () => {
    const request = new NextRequest("http://localhost:3000/api/test");
    const id = resolveRequestId(request);
    expect(id.length).toBeGreaterThan(8);
  });

  it("rejects oversized request bodies", () => {
    const request = new NextRequest("http://localhost:3000/api/test", {
      method: "POST",
      headers: {
        "content-length": String(API_MAX_BODY_BYTES + 1),
        origin: "http://localhost:3000",
      },
    });

    expect(() => assertMutatingRequestSecurity(request, "user-1")).toThrow(AppError);
  });

  it("rate limits excessive API requests", () => {
    const request = new NextRequest("http://localhost:3000/api/test", {
      method: "POST",
      headers: { origin: "http://localhost:3000" },
    });

    for (let i = 0; i < 120; i++) {
      assertMutatingRequestSecurity(request, "user-rate-test");
    }

    expect(() => assertMutatingRequestSecurity(request, "user-rate-test")).toThrow(AppError);
  });

  it("rejects cross-origin mutating requests", () => {
    const request = new NextRequest("http://localhost:3000/api/test", {
      method: "POST",
      headers: { origin: "https://evil.example.com" },
    });

    expect(() => assertMutatingRequestSecurity(request, "user-1")).toThrow(AppError);
  });
});
