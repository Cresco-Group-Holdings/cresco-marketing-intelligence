export class XProviderError extends Error {
  constructor(
    readonly code:
      | "TOKEN_EXPIRED"
      | "ENTITLEMENT_MISSING"
      | "RATE_LIMITED"
      | "MEDIA_FAILED"
      | "MEDIA_EXPIRED"
      | "POLICY_REJECTED"
      | "TRANSIENT"
      | "PROVIDER_ERROR",
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = "XProviderError";
  }
}

export function normaliseXError(status: number, detail?: string) {
  if (status === 401) return new XProviderError("TOKEN_EXPIRED", "X credentials expired.", true);
  if (status === 402 || status === 403)
    return new XProviderError(
      "ENTITLEMENT_MISSING",
      "The X API plan does not permit this publishing operation.",
      false,
    );
  if (status === 429)
    return new XProviderError("RATE_LIMITED", "X request or media quota is exhausted.", false);
  if (status === 404 || /media.*(not found|expired|invalid)/i.test(detail ?? ""))
    return new XProviderError("MEDIA_EXPIRED", "The X media upload expired.", false);
  if (status >= 500) return new XProviderError("TRANSIENT", "X is temporarily unavailable.", true);
  return new XProviderError("PROVIDER_ERROR", detail ?? "X publishing failed.", false);
}

export class XPublishingAdapter {
  constructor(
    private readonly apiBase = "https://api.x.com/2",
    private readonly mediaBase = "https://api.x.com/2/media/upload",
  ) {}

  async createPost(input: {
    accessToken: string;
    text: string;
    mediaIds?: string[];
    replyToId?: string;
  }) {
    const response = await fetch(`${this.apiBase}/tweets`, {
      method: "POST",
      headers: { authorization: `Bearer ${input.accessToken}`, "content-type": "application/json" },
      body: JSON.stringify({
        text: input.text,
        ...(input.mediaIds?.length ? { media: { media_ids: input.mediaIds } } : {}),
        ...(input.replyToId ? { reply: { in_reply_to_tweet_id: input.replyToId } } : {}),
      }),
    });
    if (!response.ok) throw normaliseXError(response.status, await response.text());
    const data = (await response.json()) as { data?: { id?: string } };
    if (!data.data?.id)
      throw new XProviderError("PROVIDER_ERROR", "X did not return a post ID.", false);
    return data.data.id;
  }

  async uploadMedia(input: {
    accessToken: string;
    sourceUrl: string;
    mimeType: string;
    sizeBytes: number;
    category: "tweet_image" | "tweet_video";
  }) {
    const mediaId = await this.initMedia(input);
    const source = await fetch(input.sourceUrl);
    if (!source.ok)
      throw new XProviderError("MEDIA_FAILED", "Could not read the signed media asset.", true);
    await this.appendSegment(
      mediaId,
      0,
      await source.arrayBuffer(),
      input.mimeType,
      input.accessToken,
    );
    const processingInfo = await this.finalizeMedia(mediaId, input.accessToken);
    return { mediaId, processingInfo };
  }

  async initMedia(input: {
    accessToken: string;
    mimeType: string;
    sizeBytes: number;
    category: "tweet_image" | "tweet_video";
  }) {
    const init = await this.mediaCommand(input.accessToken, {
      command: "INIT",
      total_bytes: String(input.sizeBytes),
      media_type: input.mimeType,
      media_category: input.category,
    });
    return String(init.media_id_string ?? init.media_id);
  }

  async appendSegment(
    mediaId: string,
    segmentIndex: number,
    bytes: ArrayBuffer,
    mimeType: string,
    accessToken: string,
  ) {
    const form = new FormData();
    form.set("command", "APPEND");
    form.set("media_id", mediaId);
    form.set("segment_index", String(segmentIndex));
    form.set("media", new Blob([bytes], { type: mimeType }));
    const append = await fetch(this.mediaBase, {
      method: "POST",
      headers: { authorization: `Bearer ${accessToken}` },
      body: form,
    });
    if (!append.ok) throw normaliseXError(append.status, await append.text());
  }

  async finalizeMedia(mediaId: string, accessToken: string) {
    const finalized = await this.mediaCommand(accessToken, {
      command: "FINALIZE",
      media_id: mediaId,
    });
    return finalized.processing_info as
      { state?: string; check_after_secs?: number; error?: { message?: string } } | undefined;
  }

  async getMediaStatus(mediaId: string, accessToken: string) {
    const url = new URL(this.mediaBase);
    url.searchParams.set("command", "STATUS");
    url.searchParams.set("media_id", mediaId);
    const response = await fetch(url, { headers: { authorization: `Bearer ${accessToken}` } });
    if (!response.ok) throw normaliseXError(response.status, await response.text());
    const data = (await response.json()) as {
      processing_info?: { state?: string; error?: { message?: string } };
    };
    const state = data.processing_info?.state ?? "succeeded";
    if (state === "succeeded") return { status: "AVAILABLE" as const, error: null };
    if (state === "failed")
      return {
        status: "FAILED" as const,
        error: data.processing_info?.error?.message ?? "Media processing failed.",
      };
    return { status: "PROCESSING" as const, error: null };
  }

  private async mediaCommand(accessToken: string, values: Record<string, string>) {
    const response = await fetch(this.mediaBase, {
      method: "POST",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams(values),
    });
    if (!response.ok) throw normaliseXError(response.status, await response.text());
    return (await response.json()) as Record<string, unknown>;
  }
}
