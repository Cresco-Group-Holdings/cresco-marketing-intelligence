import { describe, expect, it } from "vitest";
import { normaliseSlug, slugFromName } from "@/lib/utils/slug";
import { isValidDomain, normaliseDomain } from "@/lib/utils/domain";
import { isValidHexColour } from "@/lib/utils/colors";
import { hashInvitationToken, isInvitationExpired } from "@/lib/security/invitations";
import { calculateBrandProfileCompleteness } from "@/lib/brand-profile/completeness";

describe("normalisation helpers", () => {
  it("normalises slugs", () => {
    expect(normaliseSlug(" Cresco Group ")).toBe("cresco-group");
    expect(slugFromName("Capital Cresco Terminal")).toBe("capital-cresco-terminal");
  });

  it("normalises domains", () => {
    expect(normaliseDomain("https://www.Example.com/path")).toBe("example.com");
    expect(isValidDomain("example.co.uk")).toBe(true);
  });

  it("validates hex colours", () => {
    expect(isValidHexColour("#112233")).toBe(true);
    expect(isValidHexColour("blue")).toBe(false);
  });

  it("hashes invitation tokens without exposing raw values", () => {
    const token = "abc123";
    expect(hashInvitationToken(token)).not.toBe(token);
    expect(hashInvitationToken(token)).toHaveLength(64);
  });

  it("detects invitation expiry", () => {
    expect(isInvitationExpired(new Date(Date.now() - 1000))).toBe(true);
    expect(isInvitationExpired(new Date(Date.now() + 60_000))).toBe(false);
  });

  it("calculates brand profile completeness deterministically", () => {
    expect(calculateBrandProfileCompleteness({})).toBe(0);
    expect(
      calculateBrandProfileCompleteness({
        shortDescription: "Grants intelligence platform",
        targetAudience: "Founders",
        valueProposition: "Faster grant discovery",
      }),
    ).toBeGreaterThan(0);
  });
});
