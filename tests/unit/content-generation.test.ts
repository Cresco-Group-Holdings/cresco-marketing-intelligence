import { describe, expect, it } from "vitest";
import { brandContextBuilder } from "@/lib/ai/brand-context-builder";
import { scanContentSafety } from "@/lib/ai/content-safety";
import { applyPlatformAdaptation } from "@/lib/content/platform-adaptation";
import { contentGenerationRequestSchema } from "@/lib/validation/content-generation";

describe("AI Social Content Studio safeguards", () => {
  it("requires supplied text for imported article content", () => {
    const result = contentGenerationRequestSchema.safeParse({
      mode: "FROM_ARTICLE",
      platforms: ["LINKEDIN"],
      format: "TEXT_POST",
      variantCount: 1,
    });
    expect(result.success).toBe(false);
  });

  it("does not accept a URL field for retrieval or scrape it", () => {
    const result = contentGenerationRequestSchema.safeParse({
      mode: "FROM_IDEA",
      platforms: ["LINKEDIN"],
      format: "TEXT_POST",
      variantCount: 1,
      sourceText: "Approved copy supplied by the user.",
      sourceUrl: "https://untrusted.example/article",
    });
    expect(result.success).toBe(true);
    if (result.success) expect("sourceUrl" in result.data).toBe(false);
  });

  it("applies platform-specific length and hashtag limits", () => {
    const result = applyPlatformAdaptation({
      provider: "X",
      caption: "a".repeat(300),
      hashtags: ["#one", "#two", "#three", "#four"],
      hook: "A hook",
    });
    expect(result.caption).toHaveLength(280);
    expect(result.hashtags).toHaveLength(3);
    expect(result.validationErrors).not.toHaveLength(0);
  });

  it("flags potentially fabricated financial and customer claims", () => {
    const flags = scanContentSafety("Get guaranteed returns. Clients saw 250% growth.");
    expect(flags.map((flag) => flag.code)).toEqual(
      expect.arrayContaining(["FINANCIAL_GUARANTEE", "FABRICATED_RESULTS"]),
    );
  });

  it("selects only requested knowledge records", () => {
    const snapshot = {
      brand: { name: "Acme", description: "Brand" },
      profile: null,
      audiences: [
        {
          id: "a1",
          name: "Selected",
          description: null,
          painPoints: ["Pain"],
          motivations: [],
          preferredChannels: [],
        },
        {
          id: "a2",
          name: "Unselected",
          description: null,
          painPoints: ["Other"],
          motivations: [],
          preferredChannels: [],
        },
      ],
      personas: [],
      offers: [],
      messaging: null,
      voice: null,
      complianceRules: [],
    } as never;
    const context = brandContextBuilder.build(snapshot, { audienceId: "a1" });
    expect(context.audience?.name).toBe("Selected");
    expect(context.usedRecords).toEqual(
      expect.arrayContaining([{ type: "audience", id: "a1", label: "Selected" }]),
    );
    expect(context.usedRecords.some((record) => record.id === "a2")).toBe(false);
  });
});
