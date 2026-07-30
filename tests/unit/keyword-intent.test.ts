import { describe, expect, it } from "vitest";
import { classifyIntentDeterministic } from "@/lib/keywords/intent-classifier";

describe("intent classification", () => {
  it("classifies informational queries", () => {
    const result = classifyIntentDeterministic("how to improve seo");
    expect(result.intent).toBe("INFORMATIONAL");
    expect(result.source).toBe("deterministic");
  });

  it("classifies transactional queries", () => {
    const result = classifyIntentDeterministic("buy seo software");
    expect(result.intent).toBe("TRANSACTIONAL");
  });

  it("detects brand navigational", () => {
    const result = classifyIntentDeterministic("cresco marketing login", "Cresco");
    expect(["NAVIGATIONAL", "MIXED"]).toContain(result.intent);
  });
});
