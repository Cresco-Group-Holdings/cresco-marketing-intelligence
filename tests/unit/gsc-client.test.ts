import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GscHttpClient } from "@/lib/gsc/client";
import { GscApiClient } from "@/lib/gsc/client";
import { GSC_QUERY_DEFINITIONS } from "@/lib/gsc/query-registry";

describe("GSC API client", () => {
  const http: GscHttpClient = {
    get: vi.fn(),
    post: vi.fn(),
  };
  const client = new GscApiClient(http);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists accessible sites", async () => {
    vi.mocked(http.get).mockResolvedValue({
      siteEntry: [
        { siteUrl: "https://example.com/", permissionLevel: "siteOwner" },
        { siteUrl: "sc-domain:example.com", permissionLevel: "siteFullUser" },
      ],
    });

    const sites = await client.listSites("token");
    expect(sites).toHaveLength(2);
    expect(sites[0]?.siteUrl).toBe("https://example.com/");
  });

  it("paginates search analytics rows", async () => {
    vi.mocked(http.post).mockResolvedValue({
      rows: [
        {
          keys: ["20260730", "brand search"],
          clicks: 12,
          impressions: 400,
          ctr: 0.03,
          position: 7.5,
        },
      ],
    });

    const result = await client.querySearchAnalytics(
      "token",
      "https://example.com/",
      GSC_QUERY_DEFINITIONS[0]!,
      "2026-07-01",
      "2026-07-07",
      0,
      25_000,
    );

    expect(result.rows[0]?.keys).toEqual(["20260730", "brand search"]);
    expect(result.rows[0]?.clicks).toBe(12);
  });

  it("returns false when site access is not found", async () => {
    const error = new Error("Not found") as Error & { code: string };
    error.code = "NOT_FOUND";
    vi.mocked(http.get).mockRejectedValue(error);

    const valid = await client.validateSiteAccess("token", "https://missing.example/");
    expect(valid).toBe(false);
  });
});
