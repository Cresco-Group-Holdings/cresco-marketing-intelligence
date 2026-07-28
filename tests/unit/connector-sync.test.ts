import { describe, expect, it } from "vitest";
import { calculateBackoffDelayMs, withRetry } from "@/lib/connectors/sync/retry";
import { runConnectorSync } from "@/lib/connectors/sync/engine";
import { FakeConnectorAdapter } from "@/lib/connectors/adapters/fake-connector-adapter";

describe("connector sync engine", () => {
  it("applies exponential backoff", () => {
    expect(calculateBackoffDelayMs(1)).toBe(1000);
    expect(calculateBackoffDelayMs(3)).toBe(4000);
  });

  it("retries retryable failures", async () => {
    let attempts = 0;
    const result = await withRetry(
      async () => {
        attempts += 1;
        if (attempts < 2) {
          throw { category: "RATE_LIMIT", retryAfterMs: 1 };
        }
        return "ok";
      },
      {
        isRetryable: (error) =>
          typeof error === "object" &&
          error !== null &&
          "category" in error &&
          (error as { category?: string }).category === "RATE_LIMIT"
            ? { retryable: true, retryAfterMs: 1, message: "rate limited" }
            : { retryable: false, message: "fail" },
      },
    );
    expect(result).toBe("ok");
    expect(attempts).toBe(2);
  });

  it("runs idempotent cursor-based sync pages", async () => {
    const adapter = new FakeConnectorAdapter("GOOGLE_ANALYTICS_4");
    const pages: string[] = [];

    const output = await runConnectorSync({
      syncId: "sync-1",
      syncType: "INITIAL",
      adapter,
      accessToken: "token",
      context: {
        organisationId: "org-1",
        projectId: "project-1",
        brandId: "brand-1",
        connectorAccountId: "account-1",
        connectorType: "GOOGLE_ANALYTICS_4",
      },
      onPage: async (_result, cursor) => {
        if (cursor) pages.push(cursor);
      },
    });

    expect(output.status).toBe("COMPLETED");
    expect(output.recordsProcessed).toBeGreaterThan(0);
    expect(pages.length).toBeGreaterThan(0);
  });
});
