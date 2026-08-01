import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/auth/signup/route";
import { resetEnvCacheForTests } from "@/lib/environment";

vi.mock("@/lib/auth/supabase-server", () => ({
  createSupabaseServerClient: vi.fn(),
}));

vi.mock("@/lib/auth/provisioning", () => ({
  ensureUserProfile: vi.fn(),
}));

vi.mock("@/server/services/security-audit-service", () => ({
  securityAuditService: {
    record: vi.fn(),
  },
}));

import { createSupabaseServerClient } from "@/lib/auth/supabase-server";
import { ensureUserProfile } from "@/lib/auth/provisioning";

describe("POST /api/auth/signup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetEnvCacheForTests();
    process.env.APP_URL = "https://cresco-marketing-intelligence.vercel.app";
    process.env.VERCEL_URL = "cresco-marketing-intelligence.vercel.app";
    delete process.env.SUPABASE_URL;
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
  });

  it("returns JSON success and creates a Supabase user when signup succeeds", async () => {
    const signUp = vi.fn().mockResolvedValue({
      data: {
        user: {
          id: "auth-user-1",
          email: "new.user@example.com",
        },
        session: null,
      },
      error: null,
    });

    vi.mocked(createSupabaseServerClient).mockResolvedValue({
      auth: { signUp },
    } as never);

    vi.mocked(ensureUserProfile).mockResolvedValue({
      authUserId: "auth-user-1",
      email: "new.user@example.com",
      userProfileId: "profile-1",
      profile: {} as never,
      created: true,
    });

    const request = new NextRequest("https://cresco-marketing-intelligence.vercel.app/api/auth/signup", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "https://cresco-marketing-intelligence.vercel.app",
      },
      body: JSON.stringify({
        email: "new.user@example.com",
        password: "SecurePassword123",
        firstName: "New",
        lastName: "User",
      }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(body.success).toBe(true);
    expect(signUp).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "new.user@example.com",
        password: "SecurePassword123",
        options: expect.objectContaining({
          emailRedirectTo: expect.stringContaining("https://cresco-marketing-intelligence.vercel.app/auth/callback"),
        }),
      }),
    );
    expect(ensureUserProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        authUserId: "auth-user-1",
        email: "new.user@example.com",
      }),
    );
  });

  it("still returns generic JSON success when Supabase signup fails", async () => {
    const signUp = vi.fn().mockResolvedValue({
      data: { user: null, session: null },
      error: { name: "AuthApiError", message: "Invalid API key", status: 401, code: "invalid_api_key" },
    });

    vi.mocked(createSupabaseServerClient).mockResolvedValue({
      auth: { signUp },
    } as never);

    const request = new NextRequest("https://cresco-marketing-intelligence.vercel.app/api/auth/signup", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "https://cresco-marketing-intelligence.vercel.app",
      },
      body: JSON.stringify({
        email: "new.user@example.com",
        password: "SecurePassword123",
      }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(ensureUserProfile).not.toHaveBeenCalled();
  });
});
