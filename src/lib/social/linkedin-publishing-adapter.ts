export type LinkedInAuthorType = "MEMBER" | "ORGANISATION";
export type LinkedInMediaKind = "IMAGE" | "VIDEO" | "DOCUMENT";

export class LinkedInProviderError extends Error {
  constructor(
    readonly code:
      | "TOKEN_EXPIRED"
      | "PERMISSION_MISSING"
      | "INVALID_AUTHOR"
      | "UPLOAD_FAILED"
      | "PROCESSING_FAILED"
      | "RATE_LIMITED"
      | "POLICY_REJECTED"
      | "TRANSIENT"
      | "PROVIDER_ERROR",
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = "LinkedInProviderError";
  }
}

export function normaliseLinkedInError(status: number, message?: string) {
  const detail = message ?? "LinkedIn publishing failed.";
  if (status === 401)
    return new LinkedInProviderError("TOKEN_EXPIRED", "LinkedIn credentials expired.", true);
  if (status === 403) {
    return new LinkedInProviderError(
      "PERMISSION_MISSING",
      "LinkedIn posting permission is missing for the selected member or organisation.",
      false,
    );
  }
  if (status === 429)
    return new LinkedInProviderError("RATE_LIMITED", "LinkedIn rate limit reached.", true);
  if (status >= 500)
    return new LinkedInProviderError("TRANSIENT", "LinkedIn is temporarily unavailable.", true);
  if (/author|organization|organisation/i.test(detail)) {
    return new LinkedInProviderError(
      "INVALID_AUTHOR",
      "The selected LinkedIn author is invalid or inaccessible.",
      false,
    );
  }
  return new LinkedInProviderError("PROVIDER_ERROR", detail, false);
}

export class LinkedInPublishingAdapter {
  constructor(
    private readonly baseUrl = "https://api.linkedin.com/rest",
    private readonly version = "202607",
  ) {}

  private headers(accessToken: string) {
    return {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
      "Linkedin-Version": this.version,
      "X-Restli-Protocol-Version": "2.0.0",
    };
  }

  private async request(path: string, accessToken: string, init: RequestInit) {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: { ...this.headers(accessToken), ...(init.headers ?? {}) },
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { message?: string };
      throw normaliseLinkedInError(response.status, body.message);
    }
    return response;
  }

  async initialiseUpload(kind: LinkedInMediaKind, ownerUrn: string, accessToken: string) {
    const endpoint =
      kind === "IMAGE"
        ? "/images?action=initializeUpload"
        : kind === "VIDEO"
          ? "/videos?action=initializeUpload"
          : "/documents?action=initializeUpload";
    const response = await this.request(endpoint, accessToken, {
      method: "POST",
      body: JSON.stringify({ initializeUploadRequest: { owner: ownerUrn } }),
    });
    const data = (await response.json()) as {
      value: {
        uploadUrl?: string;
        uploadInstructions?: Array<{ uploadUrl: string }>;
        image?: string;
        video?: string;
        document?: string;
      };
    };
    return {
      uploadUrl: data.value.uploadUrl ?? data.value.uploadInstructions?.[0]?.uploadUrl,
      assetUrn: data.value.image ?? data.value.video ?? data.value.document,
    };
  }

  async uploadAsset(uploadUrl: string, sourceUrl: string, accessToken: string) {
    const source = await fetch(sourceUrl);
    if (!source.ok)
      throw new LinkedInProviderError(
        "UPLOAD_FAILED",
        "Could not read the signed source asset.",
        true,
      );
    const response = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": source.headers.get("content-type") ?? "application/octet-stream",
      },
      body: source.body,
      // Required by Node fetch for streamed bodies.
      duplex: "half",
    } as RequestInit & { duplex: "half" });
    if (!response.ok)
      throw new LinkedInProviderError("UPLOAD_FAILED", "LinkedIn media upload failed.", true);
  }

  async getAssetStatus(
    kind: LinkedInMediaKind,
    assetUrn: string,
    accessToken: string,
  ): Promise<"AVAILABLE" | "PROCESSING" | "FAILED" | "EXPIRED"> {
    if (kind === "IMAGE") return "AVAILABLE";
    const edge = kind === "VIDEO" ? "videos" : "documents";
    const response = await this.request(`/${edge}/${encodeURIComponent(assetUrn)}`, accessToken, {
      method: "GET",
    });
    const data = (await response.json()) as { status?: string; processingStatus?: string };
    const value = String(data.status ?? data.processingStatus ?? "PROCESSING").toUpperCase();
    if (["AVAILABLE", "READY"].includes(value)) return "AVAILABLE";
    if (["FAILED", "PROCESSING_FAILED"].includes(value)) return "FAILED";
    if (value === "EXPIRED") return "EXPIRED";
    return "PROCESSING";
  }

  async createPost(input: {
    authorUrn: string;
    commentary: string;
    accessToken: string;
    media?: { kind: LinkedInMediaKind; assetUrn: string; title?: string };
    images?: Array<{ assetUrn: string; altText?: string }>;
    article?: { source: string; title?: string; description?: string };
  }) {
    const content = input.images?.length
      ? {
          multiImage: {
            images: input.images.map((image) => ({
              id: image.assetUrn,
              ...(image.altText ? { altText: image.altText } : {}),
            })),
          },
        }
      : input.media
        ? {
            media: {
              id: input.media.assetUrn,
              ...(input.media.title ? { title: input.media.title } : {}),
            },
          }
        : input.article
          ? { article: input.article }
          : undefined;
    const response = await this.request("/posts", input.accessToken, {
      method: "POST",
      body: JSON.stringify({
        author: input.authorUrn,
        commentary: input.commentary,
        visibility: "PUBLIC",
        distribution: {
          feedDistribution: "MAIN_FEED",
          targetEntities: [],
          thirdPartyDistributionChannels: [],
        },
        lifecycleState: "PUBLISHED",
        isReshareDisabledByAuthor: false,
        ...(content ? { content } : {}),
      }),
    });
    return response.headers.get("x-restli-id") ?? response.headers.get("X-RestLi-Id");
  }
}
