import { describe, expect, it } from "vitest";
import { normaliseGa4HttpError } from "@/lib/ga4/errors";

describe("GA4 error normalisation", () => {
  it("marks quota errors as retryable", () => {
    const error = normaliseGa4HttpError(429, { error: { message: "Quota exceeded" } });
    expect(error.code).toBe("RATE_LIMITED");
    expect(error.retryable).toBe(true);
  });

  it("maps unauthorized responses", () => {
    const error = normaliseGa4HttpError(401, { error: { message: "Invalid credentials" } });
    expect(error.code).toBe("UNAUTHORIZED");
  });
});
