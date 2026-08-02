import type { EmailOtpType, SupabaseClient } from "@supabase/supabase-js";
import type { AuthError } from "@supabase/supabase-js";

export type AuthCallbackErrorCode =
  | "oauth_failed"
  | "missing_confirmation"
  | "callback_expired"
  | "callback_used"
  | "callback_pkce_verifier"
  | "invalid_callback";

export type AuthCallbackParams = {
  code: string | null;
  tokenHash: string | null;
  type: string | null;
  providerError: string | null;
  providerErrorDescription: string | null;
  requestedRedirect: string | null;
  /** Query parameter names present on the callback URL (for safe logging). */
  queryParamNames: string[];
};

const EMAIL_CONFIRMATION_TYPES = new Set<string>([
  "signup",
  "email",
  "magiclink",
  "invite",
  "recovery",
  "email_change",
]);

export function parseAuthCallbackParams(requestUrl: URL): AuthCallbackParams {
  const { searchParams } = requestUrl;

  return {
    code: searchParams.get("code"),
    tokenHash: searchParams.get("token_hash"),
    type: searchParams.get("type"),
    providerError: searchParams.get("error"),
    providerErrorDescription: searchParams.get("error_description"),
    requestedRedirect:
      searchParams.get("redirect") ?? searchParams.get("next") ?? null,
    queryParamNames: [...searchParams.keys()].sort(),
  };
}

function normalizeEmailOtpType(type: string): EmailOtpType {
  if (type === "signup" || type === "magiclink") {
    return "email";
  }

  return type as EmailOtpType;
}

function isExpiredOrInvalidMessage(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("expired") ||
    normalized.includes("invalid") ||
    normalized.includes("has expired")
  );
}

function isAlreadyUsedMessage(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("already been used") ||
    normalized.includes("already used") ||
    normalized.includes("reused")
  );
}

export function mapAuthCallbackError(error: unknown): AuthCallbackErrorCode {
  const authError = error as Partial<AuthError> | null;
  const message = authError?.message ?? "";
  const code = authError?.code ?? authError?.name ?? "";

  if (code === "AuthPKCECodeVerifierMissingError") {
    return "callback_pkce_verifier";
  }

  if (isAlreadyUsedMessage(message)) {
    return "callback_used";
  }

  if (isExpiredOrInvalidMessage(message) || code === "otp_expired") {
    return "callback_expired";
  }

  return "invalid_callback";
}

export async function completeAuthCallbackSession(
  supabase: SupabaseClient,
  params: Pick<AuthCallbackParams, "code" | "tokenHash" | "type">,
): Promise<{ error: AuthCallbackErrorCode | null }> {
  if (params.tokenHash && params.type) {
    if (!EMAIL_CONFIRMATION_TYPES.has(params.type)) {
      return { error: "invalid_callback" };
    }

    const { error } = await supabase.auth.verifyOtp({
      token_hash: params.tokenHash,
      type: normalizeEmailOtpType(params.type),
    });

    if (error) {
      return { error: mapAuthCallbackError(error) };
    }

    return { error: null };
  }

  if (params.code) {
    const { error } = await supabase.auth.exchangeCodeForSession(params.code);

    if (error) {
      return { error: mapAuthCallbackError(error) };
    }

    return { error: null };
  }

  return { error: "missing_confirmation" };
}
