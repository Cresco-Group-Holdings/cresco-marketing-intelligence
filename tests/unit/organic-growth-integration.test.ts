import { describe, expect, it } from "vitest";
import {
  buildChannelPerformanceRows,
  buildOrganicChannelPerformanceRows,
} from "@/lib/command-centre/metrics";
import {
  getStaticOrganicSocialProviderKeys,
  isOrganicSocialUnifiedKey,
  resolveUnifiedProviderOrganicStatus,
} from "@/lib/providers/organic-social-catalogue";
import { mergeProviderRegistryWithConnections } from "@/lib/organic-growth/providers";
import { detectWinningContent } from "@/lib/organic-growth/winning-content";
import { unavailableValue } from "@/lib/marketing-intelligence/format";
import type { OrganicChannelPerformance } from "@/lib/marketing-intelligence/types";

describe("canonical organic social providers", () => {
  it("maps unified social keys consistently", () => {
    expect(isOrganicSocialUnifiedKey("linkedin")).toBe(true);
    expect(isOrganicSocialUnifiedKey("google-ads")).toBe(false);
  });

  it("does not label social providers as generic coming soon in integrations status", () => {
    const linkedin = resolveUnifiedProviderOrganicStatus("linkedin");
    expect(linkedin?.organicSocial).toBe(true);
    expect(linkedin?.statusLabel).not.toBe("Coming soon");
    expect(["AVAILABLE", "BETA", "MISCONFIGURED", "DISABLED"]).toContain(linkedin?.status);
  });

  it("keeps organic and integrations provider keys aligned", () => {
    const staticKeys = getStaticOrganicSocialProviderKeys()
      .filter((item) => item.productAvailability === "available" || item.productAvailability === "beta")
      .map((item) => item.provider);
    expect(staticKeys).toContain("LINKEDIN");
    expect(staticKeys).toContain("X");
  });

  it("merges connection state without fabricating capabilities for roadmap providers", () => {
    const providers = mergeProviderRegistryWithConnections(new Set(["LINKEDIN"]), new Map());
    const threads = providers.find((provider) => provider.provider === "THREADS");
    expect(threads?.availability).toBe("coming_soon");
    expect(threads?.publish).toBe(false);
  });
});

describe("command centre organic channel rows", () => {
  const channels: OrganicChannelPerformance[] = [
    {
      provider: "LINKEDIN",
      channel: "LinkedIn",
      connected: true,
      reach: 1000,
      views: null,
      engagement: 120,
      engagementRate: 4.2,
      followers: 5000,
      followerGrowth: 40,
      shares: 10,
      saves: null,
      published: 3,
      scheduled: 1,
      dataFreshness: null,
      unavailableMetrics: [],
    },
    {
      provider: "INSTAGRAM",
      channel: "Instagram",
      connected: false,
      reach: null,
      views: null,
      engagement: null,
      engagementRate: null,
      followers: null,
      followerGrowth: null,
      shares: null,
      saves: null,
      published: 0,
      scheduled: 0,
      dataFreshness: null,
      unavailableMetrics: [],
    },
  ];

  it("builds organic rows without mixing paid metrics", () => {
    const rows = buildOrganicChannelPerformanceRows(channels, undefined, "reach");
    expect(rows[0]?.metricValue).toBe("1.0K");
    expect(rows[0]?.href).toBe("/organic-social/growth");
    expect(rows[1]?.metricValue).toBe(unavailableValue());
  });

  it("preserves unavailable organic metrics as em dash", () => {
    const rows = buildOrganicChannelPerformanceRows(channels, undefined, "engagementRate");
    expect(rows[1]?.metricValue).toBe(unavailableValue());
  });

  it("does not mix paid and organic in paid row builder", () => {
    const paidRows = buildChannelPerformanceRows(
      [],
      [{ key: "META", label: "Meta Ads", href: "/advertising/meta", connectHref: "/connectors", connected: false }],
      "spend",
      "GBP",
    );
    expect(paidRows[0]?.metricValue).toBe(unavailableValue());
  });
});

describe("winning content evidence framing", () => {
  const items = Array.from({ length: 5 }, (_, index) => ({
    id: `item-${index}`,
    title: `Post ${index}`,
    channel: "LinkedIn",
    format: "TEXT_POST",
    theme: null,
    publishedAt: "2026-08-01T00:00:00.000Z",
    reach: 1000,
    engagements: index === 0 ? 200 : 20,
    engagementRate: index === 0 ? 0.08 : 0.02,
    profileVisits: null,
    clicks: null,
  }));

  it("returns empty when sample size is insufficient", () => {
    expect(detectWinningContent(items.slice(0, 2))).toEqual([]);
  });

  it("labels evidence strength without implying causality", () => {
    const winners = detectWinningContent(items, { comparisonWindow: "last 30 days" });
    expect(winners[0]?.evidenceStrength).toBeDefined();
    expect(winners[0]?.baselineDescription).toContain("account median");
    expect(winners[0]?.disclaimer).toContain("not causal");
    expect(winners[0]?.sampleSize).toBe(5);
  });

  it("requires meaningful lift above baseline", () => {
    const flat = items.map((item) => ({ ...item, engagementRate: 0.02 }));
    expect(detectWinningContent(flat)).toEqual([]);
  });
});
