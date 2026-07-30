import { describe, expect, it } from "vitest";
import {
  isValidEventName,
  normaliseOrigin,
  sanitizeEventProperties,
} from "@/lib/tracking/payload-sanitize";

describe("tracking payload sanitisation", () => {
  it("accepts standard and custom event names", () => {
    expect(isValidEventName("page_view")).toBe(true);
    expect(isValidEventName("custom_event")).toBe(true);
    expect(isValidEventName("grant_saved")).toBe(true);
    expect(isValidEventName("my_custom_event")).toBe(true);
    expect(isValidEventName("Invalid-Event")).toBe(false);
  });

  it("removes dangerous property keys", () => {
    const result = sanitizeEventProperties({
      email: "secret@example.test",
      label: "CTA",
      count: 2,
    });
    expect(result.email).toBeUndefined();
    expect(result.label).toBe("CTA");
    expect(result.count).toBe(2);
  });

  it("normalises origins", () => {
    expect(normaliseOrigin("https://crescogroup.uk/path")).toBe("https://crescogroup.uk");
    expect(normaliseOrigin("not-a-url")).toBeNull();
  });
});
