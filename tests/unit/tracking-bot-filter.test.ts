import { describe, expect, it } from "vitest";
import { evaluateBotSignals } from "@/lib/tracking/bot-filter";

describe("tracking bot filter", () => {
  it("quarantines known bot user agents", () => {
    const result = evaluateBotSignals({
      userAgent: "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
      origin: "https://crescogroup.uk",
    });
    expect(result.quarantine).toBe(true);
    expect(result.reason).toBe("known_bot_user_agent");
  });

  it("quarantines missing user agents", () => {
    expect(evaluateBotSignals({ origin: "https://crescogroup.uk" }).quarantine).toBe(true);
  });

  it("quarantines internal monitor traffic", () => {
    const result = evaluateBotSignals({
      userAgent: "CrescoInternalMonitor/1.0",
      origin: "https://crescogroup.uk",
      isInternalTraffic: true,
    });
    expect(result.quarantine).toBe(true);
    expect(result.reason).toBe("internal_traffic");
  });

  it("accepts normal browser traffic", () => {
    const result = evaluateBotSignals({
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
      origin: "https://crescogroup.uk",
    });
    expect(result.quarantine).toBe(false);
  });
});
