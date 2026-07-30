import { describe, expect, it } from "vitest";
import { classifyChannel } from "@/lib/warehouse/channel-classification";

describe("paid ads channel classification", () => {
  it("classifies Google Ads as paid search", () => {
    const result = classifyChannel({ provider: "GOOGLE_ADS" });
    expect(result.channel).toBe("PAID_SEARCH");
  });

  it("classifies Meta as paid social", () => {
    const result = classifyChannel({ provider: "META" });
    expect(result.channel).toBe("PAID_SOCIAL");
  });

  it("classifies LinkedIn ads as paid social", () => {
    const result = classifyChannel({ provider: "LINKEDIN" });
    expect(result.channel).toBe("PAID_SOCIAL");
  });
});
