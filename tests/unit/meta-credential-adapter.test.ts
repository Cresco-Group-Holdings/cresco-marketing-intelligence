import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MetaCredentialAdapter } from "@/lib/social/meta-credential-adapter";
import { InstagramProviderError } from "@/lib/social/instagram-publishing-adapter";
import { resetEnvCacheForTests } from "@/lib/environment";

describe("MetaCredentialAdapter", () => {
  beforeEach(() => {
    process.env.META_APP_ID = "meta-app-id";
    process.env.META_APP_SECRET = "meta-app-secret";
    resetEnvCacheForTests();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    resetEnvCacheForTests();
  });

  it("exchanges the current token for a long-lived token and expiry", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ access_token: "long-lived", expires_in: 5_184_000 }), {
          status: 200,
        }),
      );
    vi.stubGlobal("fetch", fetch);

    const tokens = await new MetaCredentialAdapter("https://graph.test").refreshAccessToken({
      accessToken: "short-lived",
    });

    expect(tokens.accessToken).toBe("long-lived");
    expect(tokens.expiresAt).toBeInstanceOf(Date);
    const requestedUrl = String(fetch.mock.calls[0]![0]);
    expect(requestedUrl).toContain("grant_type=fb_exchange_token");
    expect(requestedUrl).toContain("fb_exchange_token=short-lived");
  });

  it("raises a normalised error when Meta rejects the refresh", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ error: { message: "Session has expired" } }), {
            status: 400,
          }),
        ),
    );

    await expect(
      new MetaCredentialAdapter("https://graph.test").refreshAccessToken({
        accessToken: "expired",
      }),
    ).rejects.toBeInstanceOf(InstagramProviderError);
  });

  it("refuses to refresh when Meta application credentials are absent", async () => {
    delete process.env.META_APP_ID;
    delete process.env.META_APP_SECRET;
    resetEnvCacheForTests();

    await expect(
      new MetaCredentialAdapter("https://graph.test").refreshAccessToken({ accessToken: "token" }),
    ).rejects.toThrow(/not configured/);
  });
});
