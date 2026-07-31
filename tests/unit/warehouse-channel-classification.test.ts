import { describe, expect, it } from "vitest";
import {
  CHANNEL_CLASSIFICATION_RULE_VERSION,
  TOP_LEVEL_CHANNELS,
} from "@/lib/warehouse/constants";
import {
  classifyChannel,
  isValidTopLevelChannel,
} from "@/lib/warehouse/channel-classification";

describe("warehouse channel classification", () => {
  it("classifies paid social from UTM medium and source", () => {
    const result = classifyChannel({
      utmSource: "facebook",
      utmMedium: "paid_social",
    });
    expect(result.channel).toBe("PAID_SOCIAL");
    expect(result.ruleVersion).toBe(CHANNEL_CLASSIFICATION_RULE_VERSION);
    expect(result.matchedRule).toBe("utm-medium-paid-social");
  });

  it("classifies organic search from referrer host", () => {
    const result = classifyChannel({
      referrer: "https://www.google.com/search?q=test",
    });
    expect(result.channel).toBe("ORGANIC_SEARCH");
    expect(result.matchedRule).toBe("referrer-search");
  });

  it("maps provider names to canonical channels, not provider labels", () => {
    const result = classifyChannel({ provider: "META" });
    expect(result.channel).toBe("PAID_SOCIAL");
    expect(result.channel).not.toBe("META");
  });

  it("falls back to OTHER when no rule matches", () => {
    const result = classifyChannel({});
    expect(result.channel).toBe("OTHER");
    expect(result.matchedRule).toBe("fallback-other");
  });

  it("validates top-level channel allowlist", () => {
    for (const channel of TOP_LEVEL_CHANNELS) {
      expect(isValidTopLevelChannel(channel)).toBe(true);
    }
    expect(isValidTopLevelChannel("META")).toBe(false);
  });
});
