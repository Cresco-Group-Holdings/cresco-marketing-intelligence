import { describe, expect, it } from "vitest";
import { analyzeContentPatterns } from "@/lib/growth/patterns";
import type { PostSnapshot } from "@/lib/growth/baselines";

const post = (overrides: Partial<PostSnapshot> = {}): PostSnapshot => ({
  providerPostId: "post-1",
  provider: "INSTAGRAM",
  contentItemId: "content-1",
  publishedAt: new Date("2026-07-15T14:00:00Z"),
  values: { impressions: 1000, likes: 100, comments: 10, shares: 5, saves: 5 },
  attribution: {
    contentPillar: "Education",
    contentType: "REEL",
    campaignName: "Launch",
    primaryCTA: "Learn more",
    targetAudienceId: "aud-1",
    ownerUserId: "owner-1",
    topic: "Grant readiness",
    topicSource: "provenance",
    offerId: "offer-1",
    offerName: "Starter plan",
    offerSource: "provenance",
    hook: "Did you know?",
    captionLength: 120,
    durationSeconds: 45,
    hashtags: ["grant", "funding"],
  },
  ...overrides,
});

describe("growth content patterns", () => {
  it("analyses topic, offer, and structural dimensions from real attribution", () => {
    const posts = Array.from({ length: 3 }, (_, index) =>
      post({ providerPostId: `post-${index}`, contentItemId: `content-${index}` }),
    );
    const patterns = analyzeContentPatterns(posts);
    expect(patterns.some((pattern) => pattern.dimension === "topic")).toBe(true);
    expect(patterns.some((pattern) => pattern.dimension === "offer")).toBe(true);
    expect(patterns.some((pattern) => pattern.dimension === "contentPillar")).toBe(true);
    expect(patterns.some((pattern) => pattern.dimension === "platform")).toBe(true);
    expect(patterns.some((pattern) => pattern.dimension === "owner")).toBe(true);
  });
});
