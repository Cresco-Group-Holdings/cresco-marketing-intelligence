import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Ga4HttpClient } from "@/lib/ga4/client";
import { Ga4ApiClient } from "@/lib/ga4/client";
import { GA4_QUERY_DEFINITIONS } from "@/lib/ga4/query-registry";

describe("GA4 API client", () => {
  const http: Ga4HttpClient = {
    get: vi.fn(),
    post: vi.fn(),
  };
  const client = new Ga4ApiClient(http);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("paginates account summaries", async () => {
    vi.mocked(http.get)
      .mockResolvedValueOnce({
        accountSummaries: [{ account: "accounts/1", displayName: "Main" }],
        nextPageToken: "page-2",
      })
      .mockResolvedValueOnce({
        accountSummaries: [{ account: "accounts/2", displayName: "Secondary" }],
      });

    const accounts = await client.listAccountSummaries("token");
    expect(accounts).toHaveLength(2);
    expect(http.get).toHaveBeenCalledTimes(2);
  });

  it("parses report rows with dimensions and metrics", async () => {
    vi.mocked(http.post).mockResolvedValue({
      dimensionHeaders: [{ name: "date" }],
      metricHeaders: [{ name: "sessions" }],
      rows: [
        {
          dimensionValues: [{ value: "20260730" }],
          metricValues: [{ value: "42" }],
        },
      ],
      rowCount: 1,
    });

    const result = await client.runReport(
      "token",
      "123456",
      GA4_QUERY_DEFINITIONS[0]!,
      "2026-07-01",
      "2026-07-07",
    );

    expect(result.rows[0]?.date).toBe("20260730");
    expect(result.rows[0]?.sessions).toBe(42);
  });
});
