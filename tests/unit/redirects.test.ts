import { describe, expect, it } from "vitest";
import {
  isSafeAuthenticatedRedirect,
  resolveAuthenticatedRedirect,
} from "@/lib/auth/post-auth";
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

  it("rejects auth routes as post-login destinations", () => {
    expect(isSafeAuthenticatedRedirect("/login")).toBe(false);
    expect(isSafeAuthenticatedRedirect("/auth/callback")).toBe(false);
    expect(isSafeAuthenticatedRedirect("/dashboard")).toBe(true);
  });

  it("preserves safe internal destinations", () => {
    expect(resolveAuthenticatedRedirect("/brands", "/dashboard")).toBe("/brands");
    expect(resolveAuthenticatedRedirect("https://evil.example", "/dashboard")).toBe("/dashboard");
  });
});
