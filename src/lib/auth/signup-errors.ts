import { AuthError } from "@supabase/supabase-js";
import { AppError } from "@/lib/errors";
import { logSignupCatch, logSignupTrace } from "@/lib/auth/signup-trace";
import { getSupabaseServerConfig } from "@/lib/environment/supabase";

export type SignUpStage =
  | "configuration"
  | "supabase_signup"
  | "profile_provisioning"
  | "completed";

export type SignUpOutcome = {
  stage: SignUpStage;
  userCreated: boolean;
  emailVerificationRequired: boolean;
  antiEnumeration: boolean;
  authUserId?: string;
};

const GENERIC_SIGNUP_SUCCESS_MESSAGE =
  "If this email is eligible for registration, check your inbox to verify your account.";

export function getGenericSignupSuccessMessage(): string {
  return GENERIC_SIGNUP_SUCCESS_MESSAGE;
}

function isPlaceholderValue(value: string): boolean {
  return (
    /\[YOUR|PLACEHOLDER|CHANGEME|your-project\.supabase\.co|example\.supabase\.co|test-anon|public-anon-key/i.test(
      value,
    ) || value === "your-anon-key"
  );
}

export function assertSignupAuthConfiguration(requestId?: string): void {
  if (requestId) {
    logSignupTrace("ENTER assertSignupAuthConfiguration", requestId);
  }

  try {
    const { url, anonKey } = getSupabaseServerConfig();
    const parsed = new URL(url);

    if (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1") {
      throw new AppError(
        "AUTH_CONFIGURATION_ERROR",
        "Authentication is not configured for this deployment.",
        { status: 503, expose: true },
      );
    }

    if (!parsed.hostname.endsWith("supabase.co")) {
      throw new AppError(
        "AUTH_CONFIGURATION_ERROR",
        "Authentication is not configured for this deployment.",
        { status: 503, expose: true },
      );
    }

    if (isPlaceholderValue(url) || isPlaceholderValue(anonKey) || anonKey.length < 20) {
      throw new AppError(
        "AUTH_CONFIGURATION_ERROR",
        "Authentication is not configured for this deployment.",
        { status: 503, expose: true },
      );
    }

    if (requestId) {
      logSignupTrace("EXIT assertSignupAuthConfiguration", requestId);
    }
  } catch (error) {
    if (requestId) {
      logSignupCatch("assertSignupAuthConfiguration", requestId, error);
    }
    if (error instanceof AppError) {
      throw error;
    }

    throw new AppError(
      "AUTH_CONFIGURATION_ERROR",
      "Authentication is not configured for this deployment.",
      { status: 503, expose: true, cause: error },
    );
  }
}

function asAuthLikeError(
  error: unknown,
): { code?: string; status?: number; message: string; name?: string } | null {
  if (error instanceof AuthError) {
    return error;
  }

  if (error && typeof error === "object" && "message" in error) {
    return error as { code?: string; status?: number; message: string; name?: string };
  }

  return null;
}

export function mapSignupAuthError(
  error: unknown,
  stage: SignUpStage,
  requestId?: string,
): AppError {
  if (requestId) {
    logSignupCatch(`mapSignupAuthError:${stage}`, requestId, error);
  }

  if (error instanceof AppError) {
    return error;
  }

  const authError = asAuthLikeError(error);
  if (authError) {
    if (authError.status === 429) {
      return new AppError("RATE_LIMITED", "Too many signup attempts. Please try again later.", {
        status: 429,
        expose: true,
        cause: error,
      });
    }

    if (
      authError.code === "invalid_credentials" ||
      authError.code === "validation_failed" ||
      authError.message.toLowerCase().includes("password")
    ) {
      return new AppError("VALIDATION_ERROR", authError.message, {
        status: 400,
        expose: true,
        cause: error,
      });
    }

    if (
      authError.code === "invalid_api_key" ||
      authError.code === "bad_jwt" ||
      authError.message.toLowerCase().includes("invalid api key")
    ) {
      return new AppError(
        "AUTH_CONFIGURATION_ERROR",
        "Authentication is not configured for this deployment.",
        { status: 503, expose: true, cause: error },
      );
    }

    if (authError.message.toLowerCase().includes("redirect")) {
      return new AppError(
        "AUTH_CONFIGURATION_ERROR",
        "Authentication callback URLs are not configured correctly.",
        { status: 503, expose: true, cause: error },
      );
    }

    return new AppError(
      "AUTH_PROVIDER_UNAVAILABLE",
      "The registration service is temporarily unavailable.",
      { status: 503, expose: true, cause: error },
    );
  }

  if (error instanceof Error && error.name === "AuthRetryableFetchError") {
    return new AppError(
      "AUTH_PROVIDER_UNAVAILABLE",
      "The registration service is temporarily unavailable.",
      { status: 503, expose: true, cause: error },
    );
  }

  if (stage === "profile_provisioning") {
    return new AppError(
      "PROFILE_PROVISIONING_FAILED",
      "Your account was created, but profile setup is still pending. Please try signing in again shortly.",
      { status: 503, expose: true, cause: error },
    );
  }

  return new AppError(
    "AUTH_PROVIDER_UNAVAILABLE",
    "The registration service is temporarily unavailable.",
    { status: 503, expose: true, cause: error },
  );
}

export function isAntiEnumerationSignupResponse(user: {
  identities?: Array<{ provider?: string }> | null;
} | null): boolean {
  return Boolean(user && (user.identities?.length ?? 0) === 0);
}
