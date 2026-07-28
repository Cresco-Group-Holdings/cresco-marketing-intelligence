import { beforeEach, describe, expect, it } from "vitest";
import { enforceAuthRateLimit } from "@/lib/security/auth-rate-limit";
import { resetRateLimitStoreForTests } from "@/lib/security/rate-limit";
import { AppError } from "@/lib/errors";

describe("auth rate limiting", () => {
  beforeEach(() => {
    resetRateLimitStoreForTests();
  });

  it("allows requests within the configured limit", () => {
    expect(() => enforceAuthRateLimit("login", "test-ip")).not.toThrow();
  });

  it("blocks requests after the limit is exceeded", () => {
    for (let index = 0; index < 10; index += 1) {
      enforceAuthRateLimit("login", "blocked-ip");
    }

    expect(() => enforceAuthRateLimit("login", "blocked-ip")).toThrow(AppError);
    expect(() => enforceAuthRateLimit("login", "blocked-ip")).toThrow(/Too many attempts/);
  });
});
