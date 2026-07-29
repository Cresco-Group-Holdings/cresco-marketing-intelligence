export class YouTubeProviderError extends Error {
  constructor(
    readonly code:
      | "TOKEN_EXPIRED"
      | "QUOTA_EXHAUSTED"
      | "PERMISSION_MISSING"
      | "UPLOAD_FAILED"
      | "PROCESSING_FAILED"
      | "TRANSIENT"
      | "PROVIDER_ERROR",
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = "YouTubeProviderError";
  }
}

export function normaliseYouTubeError(status: number, reason?: string) {
  if (status === 401)
    return new YouTubeProviderError("TOKEN_EXPIRED", "YouTube credentials expired.", true);
  if (reason === "quotaExceeded" || reason === "dailyLimitExceeded") {
    return new YouTubeProviderError(
      "QUOTA_EXHAUSTED",
      "YouTube quota is exhausted. Manual publishing is required until it resets.",
      false,
    );
  }
  if (status === 403)
    return new YouTubeProviderError(
      "PERMISSION_MISSING",
      "YouTube upload permission is missing.",
      false,
    );
  if (status >= 500)
    return new YouTubeProviderError("TRANSIENT", "YouTube is temporarily unavailable.", true);
  return new YouTubeProviderError("PROVIDER_ERROR", reason ?? "YouTube publishing failed.", false);
}

export class YouTubePublishingAdapter {
  constructor(
    private readonly apiBase = "https://www.googleapis.com/youtube/v3",
    private readonly uploadBase = "https://www.googleapis.com/upload/youtube/v3",
  ) {}

  async initialiseUpload(input: {
    accessToken: string;
    mimeType: string;
    sizeBytes: number;
    metadata: {
      title: string;
      description: string;
      tags: string[];
      categoryId: string;
      privacyStatus: "private" | "unlisted" | "public";
      madeForKids: boolean;
      publishAt?: string;
    };
  }) {
    const response = await fetch(
      `${this.uploadBase}/videos?uploadType=resumable&part=snippet,status`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${input.accessToken}`,
          "content-type": "application/json",
          "x-upload-content-type": input.mimeType,
          "x-upload-content-length": String(input.sizeBytes),
        },
        body: JSON.stringify({
          snippet: {
            title: input.metadata.title,
            description: input.metadata.description,
            tags: input.metadata.tags,
            categoryId: input.metadata.categoryId,
          },
          status: {
            privacyStatus: input.metadata.publishAt ? "private" : input.metadata.privacyStatus,
            selfDeclaredMadeForKids: input.metadata.madeForKids,
            ...(input.metadata.publishAt ? { publishAt: input.metadata.publishAt } : {}),
          },
        }),
      },
    );
    if (!response.ok) throw await this.error(response);
    const uploadUrl = response.headers.get("location");
    if (!uploadUrl)
      throw new YouTubeProviderError(
        "UPLOAD_FAILED",
        "YouTube did not return a resumable upload URL.",
        true,
      );
    return uploadUrl;
  }

  async uploadVideo(uploadUrl: string, sourceUrl: string, mimeType: string) {
    const source = await fetch(sourceUrl);
    if (!source.ok)
      throw new YouTubeProviderError("UPLOAD_FAILED", "Could not read the signed video.", true);
    const response = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "content-type": mimeType },
      body: source.body,
      duplex: "half",
    } as RequestInit & { duplex: "half" });
    if (!response.ok) throw await this.error(response);
    const data = (await response.json()) as { id?: string };
    if (!data.id)
      throw new YouTubeProviderError("UPLOAD_FAILED", "YouTube did not return a video ID.", true);
    return data.id;
  }

  async getProcessingStatus(videoId: string, accessToken: string) {
    const response = await fetch(
      `${this.apiBase}/videos?part=processingDetails,status&id=${encodeURIComponent(videoId)}`,
      { headers: { authorization: `Bearer ${accessToken}` } },
    );
    if (!response.ok) throw await this.error(response);
    const data = (await response.json()) as {
      items?: Array<{
        processingDetails?: { processingStatus?: string; processingFailureReason?: string };
        status?: { uploadStatus?: string };
      }>;
    };
    const details = data.items?.[0]?.processingDetails;
    const value = details?.processingStatus ?? "processing";
    if (value === "succeeded") return { status: "PROCESSED" as const, error: null };
    if (value === "failed" || value === "terminated") {
      return {
        status: "FAILED" as const,
        error: details?.processingFailureReason ?? "Video processing failed.",
      };
    }
    return { status: "PROCESSING" as const, error: null };
  }

  async uploadThumbnail(videoId: string, accessToken: string, sourceUrl: string, mimeType: string) {
    const source = await fetch(sourceUrl);
    if (!source.ok)
      throw new YouTubeProviderError("UPLOAD_FAILED", "Could not read the thumbnail.", true);
    const response = await fetch(
      `${this.uploadBase}/thumbnails/set?videoId=${encodeURIComponent(videoId)}&uploadType=media`,
      {
        method: "POST",
        headers: { authorization: `Bearer ${accessToken}`, "content-type": mimeType },
        body: source.body,
        duplex: "half",
      } as RequestInit & { duplex: "half" },
    );
    if (!response.ok) throw await this.error(response);
  }

  private async error(response: Response) {
    const data = (await response.json().catch(() => ({}))) as {
      error?: { errors?: Array<{ reason?: string }>; message?: string };
    };
    return normaliseYouTubeError(
      response.status,
      data.error?.errors?.[0]?.reason ?? data.error?.message,
    );
  }
}
