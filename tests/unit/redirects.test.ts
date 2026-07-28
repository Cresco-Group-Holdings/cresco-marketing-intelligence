import { describe, expect, it } from "vitest";
import { isSafeRedirectPath, resolveSafeRedirectPath } from "@/lib/security/redirects";

describe("safe redirect validation", () => {
  it("accepts internal relative paths", () => {
    expect(isSafeRedirectPath("/dashboard")).toBe(true);
    expect(resolveSafeRedirectPath("/brands")).toBe("/brands");
  });

  it("rejects external and protocol-relative URLs", () => {
    expect(isSafeRedirectPath("https://evil.example")).toBe(false);
    expect(isSafeRedirectPath("//evil.example")).toBe(false);
    expect(resolveSafeRedirectPath("https://evil.example", "/dashboard")).toBe("/dashboard");
  });
});
