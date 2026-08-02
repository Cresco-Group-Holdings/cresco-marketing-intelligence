import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { createRequestHeadersWithPathname, PATHNAME_HEADER } from "@/lib/middleware/pathname";

describe("createRequestHeadersWithPathname", () => {
  it("adds the current pathname to forwarded request headers", () => {
    const request = new NextRequest("https://example.com/onboarding");
    const headers = createRequestHeadersWithPathname(request);

    expect(headers.get(PATHNAME_HEADER)).toBe("/onboarding");
  });
});
