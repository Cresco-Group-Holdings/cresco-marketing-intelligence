export class FacebookProviderError extends Error {
  constructor(
    readonly code:
      | "TOKEN_EXPIRED"
      | "PERMISSION_MISSING"
      | "UPLOAD_FAILED"
      | "RATE_LIMITED"
      | "POLICY_REJECTED"
      | "TRANSIENT"
      | "PROVIDER_ERROR",
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = "FacebookProviderError";
  }
}

export function normaliseFacebookError(
  status: number,
  error?: { code?: number; message?: string },
) {
  if (error?.code === 190)
    return new FacebookProviderError("TOKEN_EXPIRED", "Facebook Page credentials expired.", true);
  if (error?.code === 200 || status === 403) {
    return new FacebookProviderError(
      "PERMISSION_MISSING",
      "Page publishing permission is missing.",
      false,
    );
  }
  if (status === 429)
    return new FacebookProviderError("RATE_LIMITED", "Facebook rate limit reached.", true);
  if (error?.code === 368 || /policy|abusive/i.test(error?.message ?? "")) {
    return new FacebookProviderError(
      "POLICY_REJECTED",
      "Facebook rejected the post under its publishing policy.",
      false,
    );
  }
  if (status >= 500)
    return new FacebookProviderError("TRANSIENT", "Facebook is temporarily unavailable.", true);
  return new FacebookProviderError(
    "PROVIDER_ERROR",
    error?.message ?? "Facebook publishing failed.",
    false,
  );
}

export class FacebookPublishingAdapter {
  constructor(private readonly baseUrl = "https://graph.facebook.com/v22.0") {}

  private async post(
    pageId: string,
    edge: string,
    accessToken: string,
    values: Record<string, string>,
  ) {
    const response = await fetch(`${this.baseUrl}/${pageId}/${edge}`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ ...values, access_token: accessToken }),
    });
    const data = (await response.json()) as {
      id?: string;
      post_id?: string;
      error?: { code?: number; message?: string };
    };
    if (!response.ok || (!data.id && !data.post_id))
      throw normaliseFacebookError(response.status, data.error);
    return data.post_id ?? data.id!;
  }

  publishTextOrLink(input: {
    pageId: string;
    accessToken: string;
    message: string;
    link?: string;
  }) {
    return this.post(input.pageId, "feed", input.accessToken, {
      message: input.message,
      ...(input.link ? { link: input.link } : {}),
    });
  }

  publishPhoto(input: { pageId: string; accessToken: string; message: string; url: string }) {
    return this.post(input.pageId, "photos", input.accessToken, {
      url: input.url,
      caption: input.message,
    });
  }

  async publishMultiplePhotos(input: {
    pageId: string;
    accessToken: string;
    message: string;
    urls: string[];
  }) {
    const media = [];
    for (const url of input.urls) {
      const id = await this.post(input.pageId, "photos", input.accessToken, {
        url,
        published: "false",
      });
      media.push({ media_fbid: id });
    }
    return this.post(input.pageId, "feed", input.accessToken, {
      message: input.message,
      attached_media: JSON.stringify(media),
    });
  }

  publishVideo(input: {
    pageId: string;
    accessToken: string;
    description: string;
    fileUrl: string;
    reel?: boolean;
  }) {
    return this.post(input.pageId, input.reel ? "video_reels" : "videos", input.accessToken, {
      description: input.description,
      file_url: input.fileUrl,
      ...(input.reel ? { upload_phase: "start" } : {}),
    });
  }

  async getPermalink(postId: string, accessToken: string) {
    const response = await fetch(
      `${this.baseUrl}/${postId}?fields=permalink_url&access_token=${encodeURIComponent(accessToken)}`,
    );
    if (!response.ok) return null;
    return ((await response.json()) as { permalink_url?: string }).permalink_url ?? null;
  }
}
