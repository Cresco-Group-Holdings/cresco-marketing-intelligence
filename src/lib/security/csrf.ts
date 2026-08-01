import type { NextRequest } from "next/server";
import { AppError } from "@/lib/errors";
import { resolveAllowedOrigins } from "@/lib/environment/app-url";

export function assertSameOrigin(request: NextRequest): void {
  const origin = request.headers.get("origin");
  if (!origin) {
    return;
  }

  const allowedOrigins = resolveAllowedOrigins();

  if (!allowedOrigins.includes(origin)) {
    throw new AppError("FORBIDDEN", "Invalid request origin.");
  }
}
