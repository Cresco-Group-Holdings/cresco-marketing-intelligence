export const GENERIC_LOGIN_ERROR =
  "Invalid email or password. Check your credentials and try again.";

export const GENERIC_SIGNUP_SUCCESS =
  "If this email is eligible for registration, check your inbox to verify your account.";

export const GENERIC_PASSWORD_RESET_SUCCESS =
  "If an account exists for that email address, password reset instructions have been sent.";

export const GENERIC_AUTH_ERROR = "Authentication failed. Please try again.";

export const AUTH_RATE_LIMIT_MESSAGE =
  "Too many attempts. Please wait a few minutes and try again.";

export const AUTH_CALLBACK_PATH = "/auth/callback";

/**
 * Supabase PKCE/SSR email confirmations must use token_hash in the signup template:
 * {{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=email&redirect=/dashboard
 * Default {{ .ConfirmationURL }} links return ?code= and fail without the signup browser's PKCE verifier.
 */
export const AUTH_ERROR_PATH = "/auth/error";

export const AUTH_AUDIT_ACTIONS = {
  SIGNUP: "auth.signup",
  LOGIN_SUCCEEDED: "auth.loginSucceeded",
  LOGIN_FAILED: "auth.loginFailed",
  LOGOUT: "auth.logout",
  EMAIL_VERIFIED: "auth.emailVerified",
  PASSWORD_RESET_REQUESTED: "auth.passwordResetRequested",
  PASSWORD_CHANGED: "auth.passwordChanged",
  OAUTH_CONNECTED: "auth.oauthConnected",
  SESSION_REVOKED: "auth.sessionRevoked",
} as const;
