import type { NextRequest } from "next/server";

export function getClientIpAddress(request: NextRequest | Request): string | undefined {
  if ("headers" in request) {
    const forwarded = request.headers.get("x-forwarded-for");
    if (forwarded) {
      return forwarded.split(",")[0]?.trim();
    }

    return request.headers.get("x-real-ip") ?? undefined;
  }

  return undefined;
}
