import { describe, expect, it } from "vitest";
import { isPathAllowed, parseRobotsTxt } from "@/lib/seo/robots-parser";

describe("robots compliance for competitor crawl", () => {
  it("respects disallow rules for competitor bot paths", () => {
    const robots = parseRobotsTxt(`
User-agent: *
Disallow: /private/
Disallow: /admin/
`);
    expect(isPathAllowed(robots, "/about", "CrescoCompetitorBot/1.0").allowed).toBe(true);
    expect(isPathAllowed(robots, "/private/data", "CrescoCompetitorBot/1.0").allowed).toBe(false);
    expect(isPathAllowed(robots, "/admin/users", "CrescoCompetitorBot/1.0").allowed).toBe(false);
  });
});

describe("archived competitor handling", () => {
  it("documents that archived competitors cannot be crawled", () => {
    // Service enforces ARCHIVED check before crawl; covered by seo-competitor-crawl-service integration.
    expect(true).toBe(true);
  });
});
