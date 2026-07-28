import { describe, expect, it } from "vitest";
import { AppError } from "@/lib/errors";
import { apiFailure, apiSuccess, createRequestId } from "@/lib/api/response";

describe("API response helpers", () => {
  it("returns a success envelope", async () => {
    const response = apiSuccess({ hello: "world" }, { page: 1 });
    const body = await response.json();

    expect(body.success).toBe(true);
    expect(body.data).toEqual({ hello: "world" });
    expect(body.meta).toEqual({ page: 1 });
    expect(body.error).toBeNull();
  });

  it("returns a failure envelope without secrets", async () => {
    const requestId = createRequestId();
    const response = apiFailure(
      new AppError("FORBIDDEN", "You do not have access."),
      requestId,
    );
    const body = await response.json();

    expect(body.success).toBe(false);
    expect(body.data).toBeNull();
    expect(body.error).toEqual({
      code: "FORBIDDEN",
      message: "You do not have access.",
      requestId,
    });
  });
});
