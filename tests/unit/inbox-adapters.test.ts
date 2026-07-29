import { describe, expect, it } from "vitest";
import type { SocialProvider } from "@prisma/client";
import {
  getSocialInboxAdapter,
  SocialInboxProviderError,
} from "@/lib/social/inbox-adapters";

const PROVIDERS: SocialProvider[] = [
  "INSTAGRAM",
  "FACEBOOK",
  "LINKEDIN",
  "TIKTOK",
  "YOUTUBE",
  "X",
];

describe("getSocialInboxAdapter", () => {
  for (const provider of PROVIDERS) {
    it(`returns an adapter for ${provider}`, () => {
      const adapter = getSocialInboxAdapter(provider);
      expect(adapter.provider).toBe(provider);
    });
  }

  it("returns undefined for an unregistered provider key", () => {
    expect(getSocialInboxAdapter("UNKNOWN" as SocialProvider)).toBeUndefined();
  });
});

describe("mock inbox adapter fetch methods", () => {
  const token = { accessToken: "mock-token", providerAccountId: "account-1" };

  for (const provider of PROVIDERS) {
    describe(provider, () => {
      const adapter = getSocialInboxAdapter(provider);

      it("fetchComments returns mock comment interactions", async () => {
        const result = await adapter.fetchComments(token);
        expect(result.hasMore).toBe(false);
        expect(result.items.length).toBeGreaterThan(0);
        expect(result.items[0]).toMatchObject({
          kind: "COMMENT",
          body: expect.any(String),
          author: expect.objectContaining({ providerParticipantId: expect.any(String) }),
          isDeleted: false,
        });
      });

      it("fetchMentions returns mentions when supported", async () => {
        const result = await adapter.fetchMentions(token);
        expect(result.hasMore).toBe(false);
        if (provider === "TIKTOK") {
          expect(result.items).toHaveLength(0);
        } else {
          expect(result.items.length).toBeGreaterThan(0);
          expect(result.items[0]).toMatchObject({ kind: "MENTION" });
        }
      });

      it("fetchDirectMessages returns DMs when supported", async () => {
        const result = await adapter.fetchDirectMessages(token);
        expect(result.hasMore).toBe(false);
        if (provider === "FACEBOOK" || provider === "X") {
          expect(result.items.length).toBeGreaterThan(0);
          expect(result.items[0]).toMatchObject({
            kind: "DIRECT_MESSAGE",
            direction: "INBOUND",
          });
        } else {
          expect(result.items).toHaveLength(0);
        }
      });

      it("sendReply returns a provider message id", async () => {
        const result = await adapter.sendReply({
          ...token,
          providerConversationId: "conv-1",
          providerTargetId: "target-1",
          body: "Thanks for reaching out!",
        });
        expect(result.providerMessageId).toMatch(new RegExp(`^${provider.toLowerCase()}-reply-`));
        expect(result.providerCreatedAt).toBeInstanceOf(Date);
      });

      it("hideComment resolves without error", async () => {
        await expect(
          adapter.hideComment({
            ...token,
            providerCommentId: "comment-1",
          }),
        ).resolves.toBeUndefined();
      });

      it("rejects fetch when the access token is missing", async () => {
        await expect(
          adapter.fetchComments({ accessToken: "", providerAccountId: "account-1" }),
        ).rejects.toBeInstanceOf(SocialInboxProviderError);
      });
    });
  }
});
