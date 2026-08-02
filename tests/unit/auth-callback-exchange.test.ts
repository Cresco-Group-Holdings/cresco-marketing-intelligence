import { describe, expect, it } from "vitest";
import {
  mapAuthCallbackError,
  parseAuthCallbackParams,
} from "@/lib/auth/callback-exchange";

describe("parseAuthCallbackParams", () => {
  it("records query parameter names without exposing values", () => {
    const params = parseAuthCallbackParams(
      new URL(
        "https://cresco-marketing-intelligence.vercel.app/auth/callback?token_hash=secret&type=email&redirect=/dashboard",
      ),
    );

    expect(params.tokenHash).toBe("secret");
    expect(params.type).toBe("email");
    expect(params.requestedRedirect).toBe("/dashboard");
    expect(params.queryParamNames).toEqual(["redirect", "token_hash", "type"]);
  });

  it("accepts next as a redirect alias", () => {
    const params = parseAuthCallbackParams(
      new URL("https://example.com/auth/callback?token_hash=secret&type=email&next=/onboarding"),
    );

    expect(params.requestedRedirect).toBe("/onboarding");
  });
});

describe("mapAuthCallbackError", () => {
  it("maps missing PKCE verifier errors", () => {
    expect(
      mapAuthCallbackError({
        name: "AuthPKCECodeVerifierMissingError",
        message: "PKCE code verifier not found in storage.",
      }),
    ).toBe("callback_pkce_verifier");
  });

  it("maps expired confirmation links", () => {
    expect(
      mapAuthCallbackError({
        message: "Email link is invalid or has expired",
      }),
    ).toBe("callback_expired");
  });

  it("maps reused confirmation links", () => {
    expect(
      mapAuthCallbackError({
        message: "This email link has already been used",
      }),
    ).toBe("callback_used");
  });
});
