import { describe, expect, it } from "vitest";
import { detectSafetyFlags, requiresHumanReview } from "@/lib/inbox/safety";

describe("detectSafetyFlags", () => {
  it("detects spam patterns", () => {
    expect(detectSafetyFlags("Click here now to buy followers!")).toContain("SPAM");
    expect(detectSafetyFlags("Get free money today")).toContain("SPAM");
    expect(detectSafetyFlags("Act now before it is too late")).toContain("SPAM");
  });

  it("detects abusive language", () => {
    expect(detectSafetyFlags("You are such an idiot")).toContain("ABUSIVE_LANGUAGE");
    expect(detectSafetyFlags("I hate you so much")).toContain("ABUSIVE_LANGUAGE");
    expect(detectSafetyFlags("Why don't you kill yourself")).toContain("ABUSIVE_LANGUAGE");
  });

  it("detects personal data (PII)", () => {
    expect(detectSafetyFlags("Call me at 555-123-4567")).toContain("PERSONAL_DATA");
    expect(detectSafetyFlags("Email me at user@example.com")).toContain("PERSONAL_DATA");
    expect(detectSafetyFlags("My number is 555.123.4567")).toContain("PERSONAL_DATA");
  });

  it("detects threats", () => {
    expect(detectSafetyFlags("I will hurt you if this continues")).toContain("THREAT");
    expect(detectSafetyFlags("I will sue your company")).toContain("THREAT");
    expect(detectSafetyFlags("Taking legal action against you")).toContain("THREAT");
  });

  it("detects financial advice", () => {
    expect(detectSafetyFlags("Guaranteed returns on this investment")).toContain("FINANCIAL_ADVICE");
    expect(detectSafetyFlags("Invest now for risk-free growth")).toContain("FINANCIAL_ADVICE");
    expect(detectSafetyFlags("This is not financial advice but buy now")).toContain(
      "FINANCIAL_ADVICE",
    );
  });

  it("detects grant eligibility claims", () => {
    expect(detectSafetyFlags("Everyone qualifies for this guaranteed grant")).toContain(
      "GRANT_ELIGIBILITY",
    );
    expect(detectSafetyFlags("Apply for free government money today")).toContain(
      "GRANT_ELIGIBILITY",
    );
  });

  it("detects complaints requiring review", () => {
    expect(detectSafetyFlags("I want a refund immediately")).toContain("COMPLAINT_REVIEW");
    expect(detectSafetyFlags("I am filing a complaint about your service")).toContain(
      "COMPLAINT_REVIEW",
    );
    expect(detectSafetyFlags("I am unsatisfied and will contact my lawyer")).toContain(
      "COMPLAINT_REVIEW",
    );
  });

  it("returns no flags for benign messages", () => {
    expect(detectSafetyFlags("Thanks for the helpful update!")).toEqual([]);
    expect(detectSafetyFlags("When does your support team open?")).toEqual([]);
  });

  it("deduplicates multiple matching rules of the same flag", () => {
    const flags = detectSafetyFlags("Click here now and act now for free money");
    expect(flags.filter((flag) => flag === "SPAM")).toHaveLength(1);
  });

  it("can detect multiple distinct flags in one message", () => {
    const flags = detectSafetyFlags(
      "I want a refund — call me at 555-123-4567 or email fraud@example.com",
    );
    expect(flags).toContain("COMPLAINT_REVIEW");
    expect(flags).toContain("PERSONAL_DATA");
  });
});

describe("requiresHumanReview", () => {
  it("requires review for high-risk flags", () => {
    expect(requiresHumanReview(["THREAT"])).toBe(true);
    expect(requiresHumanReview(["PERSONAL_DATA"])).toBe(true);
    expect(requiresHumanReview(["FINANCIAL_ADVICE"])).toBe(true);
    expect(requiresHumanReview(["GRANT_ELIGIBILITY"])).toBe(true);
    expect(requiresHumanReview(["COMPLAINT_REVIEW"])).toBe(true);
  });

  it("does not require review for spam or abusive language alone", () => {
    expect(requiresHumanReview(["SPAM"])).toBe(false);
    expect(requiresHumanReview(["ABUSIVE_LANGUAGE"])).toBe(false);
  });

  it("requires review when any high-risk flag is present among others", () => {
    expect(requiresHumanReview(["SPAM", "THREAT"])).toBe(true);
  });
});
