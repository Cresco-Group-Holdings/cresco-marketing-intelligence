import { describe, expect, it } from "vitest";
import { detectCannibalisation } from "@/lib/keywords/cannibalisation";

describe("cannibalisation detection", () => {
  it("returns null with single page", () => {
    expect(detectCannibalisation("seo tools", [{ url: "/a" }])).toBeNull();
  });

  it("detects possible cannibalisation", () => {
    const result = detectCannibalisation("seo tools", [
      { url: "/page-a", position: 5, title: "Best SEO Tools Guide" },
      { url: "/page-b", position: 12, title: "SEO Tools for Beginners" },
    ]);
    expect(result?.status).toBe("POSSIBLE");
  });

  it("detects likely when multiple explicit targets", () => {
    const result = detectCannibalisation("seo tools", [
      { url: "/a", isExplicitTarget: true },
      { url: "/b", isExplicitTarget: true },
    ]);
    expect(result?.status).toBe("LIKELY");
  });
});
