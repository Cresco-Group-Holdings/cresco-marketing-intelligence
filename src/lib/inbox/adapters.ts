import type { SocialProvider } from "@prisma/client";
import type { InboxFetchResult } from "@/lib/inbox/types";

export class SocialInboxProviderError extends Error {
  constructor(
    readonly code:
      | "RATE_LIMITED"
      | "TOKEN_EXPIRED"
      | "PERMISSION_MISSING"
      | "NOT_FOUND"
      | "TRANSIENT"
      | "PROVIDER_ERROR",
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = "SocialInboxProviderError";
  }
}

export interface SocialInboxAdapter {
  readonly provider: SocialProvider;
  fetchPage(input: {
    accessToken: string;
    providerAccountId: string;
    cursor?: string;
  }): Promise<InboxFetchResult>;
  sendReply?(input: {
    accessToken: string;
    providerAccountId: string;
    providerTargetId: string;
    body: string;
    replyType: "COMMENT" | "MESSAGE" | "MENTION";
  }): Promise<{ providerMessageId: string }>;
  hideComment?(input: {
    accessToken: string;
    providerAccountId: string;
    providerCommentId: string;
  }): Promise<void>;
}

const emptyPage = (): InboxFetchResult => ({
  batch: {},
  hasMore: false,
});

function createMockAdapter(provider: SocialProvider): SocialInboxAdapter {
  return {
    provider,
    async fetchPage() {
      return emptyPage();
    },
    async sendReply(input) {
      return { providerMessageId: `mock-reply-${input.providerTargetId}` };
    },
    async hideComment() {
      return;
    },
  };
}

const ADAPTERS: Partial<Record<SocialProvider, SocialInboxAdapter>> = {
  INSTAGRAM: createMockAdapter("INSTAGRAM"),
  FACEBOOK: createMockAdapter("FACEBOOK"),
  LINKEDIN: createMockAdapter("LINKEDIN"),
  TIKTOK: createMockAdapter("TIKTOK"),
  YOUTUBE: createMockAdapter("YOUTUBE"),
  X: createMockAdapter("X"),
};

export function getSocialInboxAdapter(provider: SocialProvider): SocialInboxAdapter {
  const adapter = ADAPTERS[provider];
  if (!adapter) {
    throw new SocialInboxProviderError(
      "PROVIDER_ERROR",
      `Inbox adapter is not registered for ${provider}.`,
      false,
    );
  }
  return adapter;
}

export function registerSocialInboxAdapter(adapter: SocialInboxAdapter): void {
  ADAPTERS[adapter.provider] = adapter;
}
