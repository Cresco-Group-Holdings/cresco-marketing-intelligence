import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

describe("apiFetch non-JSON safety", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        status: 500,
        url: "http://localhost:3000/api/auth/signup",
        headers: {
          get: (name: string) =>
            name.toLowerCase() === "content-type" ? "text/html; charset=utf-8" : null,
        },
        json: async () => {
          throw new SyntaxError("Unexpected token '<'");
        },
      })),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("does not parse HTML error pages as JSON", async () => {
    const { apiFetch } = await import("@/lib/api/client");

    await expect(
      apiFetch("/api/auth/signup", {
        method: "POST",
        body: JSON.stringify({ email: "user@example.com", password: "Password123!" }),
      }),
    ).rejects.toThrow("The service is temporarily unavailable.");
  });
});
