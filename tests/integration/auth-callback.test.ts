import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "@/app/auth/callback/route";

vi.mock("@/lib/auth/supabase-server", () => ({
  createSupabaseServerClient: vi.fn(),
}));

vi.mock("@/server/services/auth-service", () => ({
  authService: {
    provisionFromAuthUser: vi.fn(),
    recordOAuthConnected: vi.fn(),
    recordEmailVerified: vi.fn(),
    recordLoginSucceeded: vi.fn(),
  },
}));

import { createSupabaseServerClient } from "@/lib/auth/supabase-server";
import { authService } from "@/server/services/auth-service";

function mockSupabaseClient(overrides: {
  verifyOtp?: ReturnType<typeof vi.fn>;
  exchangeCodeForSession?: ReturnType<typeof vi.fn>;
  getUser?: ReturnType<typeof vi.fn>;
}) {
  vi.mocked(createSupabaseServerClient).mockResolvedValue({
    auth: {
      verifyOtp: overrides.verifyOtp ?? vi.fn().mockResolvedValue({ error: null }),
      exchangeCodeForSession:
        overrides.exchangeCodeForSession ?? vi.fn().mockResolvedValue({ error: null }),
      getUser:
        overrides.getUser ??
        vi.fn().mockResolvedValue({
          data: {
            user: {
              id: "auth-1",
              email: "user@example.com",
              app_metadata: { provider: "email" },
              email_confirmed_at: "2026-01-01T00:00:00.000Z",
            },
          },
        }),
    },
  } as never);
}

describe("auth callback handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authService.provisionFromAuthUser).mockResolvedValue({
      authUserId: "auth-1",
      email: "user@example.com",
      userProfileId: "profile-1",
      profile: {} as never,
      created: false,
      redirectPath: "/dashboard",
    });
  });

  it("redirects to the auth error page when the provider returns an error", async () => {
    const request = new NextRequest("http://localhost:3000/auth/callback?error=access_denied");
    const response = await GET(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/auth/error?code=oauth_failed");
  });

  it("redirects to the auth error page when no confirmation parameters are present", async () => {
    mockSupabaseClient({});

    const request = new NextRequest("http://localhost:3000/auth/callback");
    const response = await GET(request);

    expect(response.headers.get("location")).toContain("/auth/error?code=missing_confirmation");
  });

  it("redirects safely after a successful PKCE code exchange", async () => {
    const exchangeCodeForSession = vi.fn().mockResolvedValue({ error: null });
    mockSupabaseClient({
      exchangeCodeForSession,
      getUser: vi.fn().mockResolvedValue({
        data: {
          user: {
            id: "auth-1",
            email: "user@example.com",
            app_metadata: { provider: "google" },
            email_confirmed_at: "2026-01-01T00:00:00.000Z",
          },
        },
      }),
    });

    const request = new NextRequest(
      "http://localhost:3000/auth/callback?code=abc123&redirect=/dashboard",
    );
    const response = await GET(request);

    expect(exchangeCodeForSession).toHaveBeenCalledWith("abc123");
    expect(response.headers.get("location")).toBe("http://localhost:3000/dashboard");
    expect(authService.recordLoginSucceeded).toHaveBeenCalled();
  });

  it("verifies email confirmation links with token_hash and type", async () => {
    const verifyOtp = vi.fn().mockResolvedValue({ error: null });
    mockSupabaseClient({ verifyOtp });

    const request = new NextRequest(
      "http://localhost:3000/auth/callback?token_hash=hash-value&type=email&redirect=/onboarding",
    );
    const response = await GET(request);

    expect(verifyOtp).toHaveBeenCalledWith({
      token_hash: "hash-value",
      type: "email",
    });
    expect(response.headers.get("location")).toBe("http://localhost:3000/onboarding");
    expect(authService.recordEmailVerified).toHaveBeenCalled();
  });

  it("maps signup token_hash type to email verification", async () => {
    const verifyOtp = vi.fn().mockResolvedValue({ error: null });
    mockSupabaseClient({ verifyOtp });

    const request = new NextRequest(
      "http://localhost:3000/auth/callback?token_hash=hash-value&type=signup",
    );
    await GET(request);

    expect(verifyOtp).toHaveBeenCalledWith({
      token_hash: "hash-value",
      type: "email",
    });
  });

  it("redirects to callback_expired when token verification fails with an expired message", async () => {
    mockSupabaseClient({
      verifyOtp: vi.fn().mockResolvedValue({
        error: { message: "Email link is invalid or has expired" },
      }),
    });

    const request = new NextRequest(
      "http://localhost:3000/auth/callback?token_hash=hash-value&type=email",
    );
    const response = await GET(request);

    expect(response.headers.get("location")).toContain("/auth/error?code=callback_expired");
  });

  it("redirects to callback_pkce_verifier when PKCE code exchange lacks a verifier", async () => {
    mockSupabaseClient({
      exchangeCodeForSession: vi.fn().mockResolvedValue({
        error: {
          name: "AuthPKCECodeVerifierMissingError",
          message: "PKCE code verifier not found in storage.",
        },
      }),
    });

    const request = new NextRequest("http://localhost:3000/auth/callback?code=bad");
    const response = await GET(request);

    expect(response.headers.get("location")).toContain(
      "/auth/error?code=callback_pkce_verifier",
    );
  });

  it("redirects to provisioning_failed when profile setup fails after verification", async () => {
    mockSupabaseClient({
      verifyOtp: vi.fn().mockResolvedValue({ error: null }),
    });
    vi.mocked(authService.provisionFromAuthUser).mockRejectedValue(new Error("database unavailable"));

    const request = new NextRequest(
      "http://localhost:3000/auth/callback?token_hash=hash-value&type=email",
    );
    const response = await GET(request);

    expect(response.headers.get("location")).toContain("/auth/error?code=provisioning_failed");
  });
});
