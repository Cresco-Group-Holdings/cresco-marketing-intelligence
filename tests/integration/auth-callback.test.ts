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

describe("OAuth callback handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects to the auth error page when the provider returns an error", async () => {
    const request = new NextRequest("http://localhost:3000/auth/callback?error=access_denied");
    const response = await GET(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/auth/error?code=oauth_failed");
  });

  it("redirects to the auth error page when the code is missing", async () => {
    const request = new NextRequest("http://localhost:3000/auth/callback");
    const response = await GET(request);

    expect(response.headers.get("location")).toContain("/auth/error?code=missing_code");
  });

  it("redirects safely after a successful code exchange", async () => {
    vi.mocked(createSupabaseServerClient).mockResolvedValue({
      auth: {
        exchangeCodeForSession: vi.fn().mockResolvedValue({ error: null }),
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
      },
    } as never);

    vi.mocked(authService.provisionFromAuthUser).mockResolvedValue({
      authUserId: "auth-1",
      email: "user@example.com",
      userProfileId: "profile-1",
      profile: {} as never,
      created: false,
      redirectPath: "/dashboard",
    });

    const request = new NextRequest(
      "http://localhost:3000/auth/callback?code=abc123&redirect=/dashboard",
    );
    const response = await GET(request);

    expect(response.headers.get("location")).toBe("http://localhost:3000/dashboard");
    expect(authService.recordLoginSucceeded).toHaveBeenCalled();
  });

  it("redirects to the auth error page when code exchange fails", async () => {
    vi.mocked(createSupabaseServerClient).mockResolvedValue({
      auth: {
        exchangeCodeForSession: vi
          .fn()
          .mockResolvedValue({ error: { message: "invalid code" } }),
        getUser: vi.fn(),
      },
    } as never);

    const request = new NextRequest("http://localhost:3000/auth/callback?code=bad");
    const response = await GET(request);

    expect(response.headers.get("location")).toContain("/auth/error?code=invalid_callback");
  });
});
