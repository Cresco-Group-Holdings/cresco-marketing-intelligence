import type { NextRequest } from "next/server";
import { AppError } from "@/lib/errors";
import { getServerEnv } from "@/lib/environment";

export function assertSameOrigin(request: NextRequest): void {
  const origin = request.headers.get("origin");
  if (!origin) {
    return;
  }

  const { APP_URL } = getServerEnv();
  const allowedOrigin = new URL(APP_URL).origin;

  if (origin !== allowedOrigin) {
    throw new AppError("FORBIDDEN", "Invalid request origin.");
  }
}
