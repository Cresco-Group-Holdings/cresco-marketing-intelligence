import { AppError } from "@/lib/errors";
import { AUTH_RATE_LIMIT_MESSAGE } from "@/lib/auth/constants";
import { checkRateLimit } from "@/lib/security/rate-limit";

export type AuthRateLimitAction =
  | "login"
  | "signup"
  | "forgot-password"
  | "reset-password"
  | "change-password"
  | "verify-email"
  | "oauth";

const AUTH_RATE_LIMITS: Record<AuthRateLimitAction, { limit: number; windowMs: number }> = {
  login: { limit: 10, windowMs: 15 * 60 * 1000 },
  signup: { limit: 5, windowMs: 60 * 60 * 1000 },
  "forgot-password": { limit: 5, windowMs: 60 * 60 * 1000 },
  "reset-password": { limit: 10, windowMs: 60 * 60 * 1000 },
  "change-password": { limit: 5, windowMs: 60 * 60 * 1000 },
  "verify-email": { limit: 3, windowMs: 60 * 60 * 1000 },
  oauth: { limit: 10, windowMs: 15 * 60 * 1000 },
};

export function enforceAuthRateLimit(action: AuthRateLimitAction, identifier: string): void {
  const config = AUTH_RATE_LIMITS[action];
  const result = checkRateLimit({
    key: `auth:${action}:${identifier}`,
    limit: config.limit,
    windowMs: config.windowMs,
  });

  if (!result.allowed) {
    throw new AppError("RATE_LIMITED", AUTH_RATE_LIMIT_MESSAGE);
  }
}
