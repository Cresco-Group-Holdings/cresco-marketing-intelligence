import { describe, expect, it } from "vitest";
import { isBlockedHostname, validateCrawlUrl } from "@/lib/seo/ssrf-guard";

describe("SSRF guard", () => {
  it("blocks localhost", () => {
    expect(isBlockedHostname("localhost")).toBe(true);
    expect(isBlockedHostname("127.0.0.1")).toBe(true);
  });

  it("blocks private IPs", () => {
    expect(isBlockedHostname("192.168.1.1")).toBe(true);
    expect(isBlockedHostname("10.0.0.1")).toBe(true);
    expect(isBlockedHostname("169.254.169.254")).toBe(true);
  });

  it("blocks non-allowed hostnames", () => {
    const result = validateCrawlUrl("https://evil.com/page", ["example.com"]);
    expect(result.allowed).toBe(false);
  });

  it("allows verified domain", () => {
    const result = validateCrawlUrl("https://example.com/page", ["example.com"]);
    expect(result.allowed).toBe(true);
  });

  it("blocks file protocol", () => {
    const result = validateCrawlUrl("file:///etc/passwd", ["example.com"]);
    expect(result.allowed).toBe(false);
  });
});
