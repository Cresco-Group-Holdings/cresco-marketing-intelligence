import type { NextRequest } from "next/server";

export const PATHNAME_HEADER = "x-pathname";

export function createRequestHeadersWithPathname(request: NextRequest): Headers {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(PATHNAME_HEADER, request.nextUrl.pathname);
  return requestHeaders;
}
