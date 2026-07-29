import { AppError } from "@/lib/errors";

export type InstagramMediaType = "IMAGE" | "CAROUSEL" | "REELS";

export type InstagramContainerInput = {
  igUserId: string;
  accessToken: string;
  mediaUrls: string[];
  mediaType: InstagramMediaType;
  caption?: string;
  altText?: string;
};

/**
 * Meta reports asynchronous container processing through `status_code`. Only FINISHED
 * containers may be published; EXPIRED and ERROR are terminal.
 */
export type InstagramContainerStatus =
  "IN_PROGRESS" | "FINISHED" | "ERROR" | "EXPIRED" | "PUBLISHED";

export type InstagramProviderErrorCode =
  | "TOKEN_EXPIRED"
  | "PERMISSION_MISSING"
  | "RATE_LIMITED"
  | "UNSUPPORTED_MEDIA"
  | "MEDIA_UNREACHABLE"
  | "POLICY_REJECTED"
  | "TRANSIENT"
  | "PROVIDER_ERROR";

export class InstagramProviderError extends Error {
  constructor(
    readonly code: InstagramProviderErrorCode,
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = "InstagramProviderError";
  }
}

type GraphError = { message?: string; code?: number; error_subcode?: number };

export function normaliseInstagramError(
  error: GraphError | undefined,
  status: number,
): InstagramProviderError {
  const message = error?.message ?? "Instagram request failed.";
  if (status === 429 || /rate limit|too many calls/i.test(message)) {
    return new InstagramProviderError(
      "RATE_LIMITED",
      "Instagram rate limit reached. The publish will be retried.",
      true,
    );
  }
  if (/access token|session has expired|oauth/i.test(message)) {
    return new InstagramProviderError(
      "TOKEN_EXPIRED",
      "Instagram credentials expired and must be refreshed.",
      true,
    );
  }
  if (/permission|not authorized|professional/i.test(message)) {
    return new InstagramProviderError(
      "PERMISSION_MISSING",
      "The connected Instagram account is missing publishing permission or is not a professional account.",
      false,
    );
  }
  if (/aspect ratio|format|unsupported|duration/i.test(message)) {
    return new InstagramProviderError(
      "UNSUPPORTED_MEDIA",
      "The media does not meet Instagram's format requirements.",
      false,
    );
  }
  if (/download|fetch|url|curl/i.test(message)) {
    return new InstagramProviderError(
      "MEDIA_UNREACHABLE",
      "Instagram could not retrieve the supplied media URL.",
      true,
    );
  }
  if (/policy|community guidelines|violat/i.test(message)) {
    return new InstagramProviderError(
      "POLICY_REJECTED",
      "Instagram rejected the content under its publishing policy.",
      false,
    );
  }
  if (status >= 500) {
    return new InstagramProviderError(
      "TRANSIENT",
      "Instagram is temporarily unavailable. The publish will be retried.",
      true,
    );
  }
  return new InstagramProviderError("PROVIDER_ERROR", message, false);
}

export class InstagramPublishingAdapter {
  constructor(private readonly graphBaseUrl = "https://graph.facebook.com/v22.0") {}

  private async post(path: string, body: Record<string, string>) {
    const response = await fetch(`${this.graphBaseUrl}${path}`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(body),
    });
    const data = (await response.json()) as { id?: string; error?: GraphError };
    if (!response.ok || !data.id) {
      throw normaliseInstagramError(data.error, response.status);
    }
    return data.id;
  }

  /** Creates the container that will later be published. Safe to call only once per job. */
  async createContainer(input: InstagramContainerInput): Promise<string> {
    if (input.mediaUrls.length === 0) {
      throw new InstagramProviderError(
        "UNSUPPORTED_MEDIA",
        "At least one media item is required.",
        false,
      );
    }

    if (input.mediaType === "CAROUSEL") {
      const children: string[] = [];
      for (const url of input.mediaUrls) {
        children.push(
          await this.post(`/${input.igUserId}/media`, {
            image_url: url,
            is_carousel_item: "true",
            access_token: input.accessToken,
          }),
        );
      }
      return this.post(`/${input.igUserId}/media`, {
        media_type: "CAROUSEL",
        children: children.join(","),
        caption: input.caption ?? "",
        access_token: input.accessToken,
      });
    }

    const isReel = input.mediaType === "REELS";
    return this.post(`/${input.igUserId}/media`, {
      [isReel ? "video_url" : "image_url"]: input.mediaUrls[0]!,
      ...(isReel ? { media_type: "REELS" } : {}),
      caption: input.caption ?? "",
      // Meta supports alt_text on image posts only.
      ...(!isReel && input.altText ? { alt_text: input.altText } : {}),
      access_token: input.accessToken,
    });
  }

  async getContainerStatus(
    containerId: string,
    accessToken: string,
  ): Promise<{ status: InstagramContainerStatus; error?: string }> {
    const response = await fetch(
      `${this.graphBaseUrl}/${containerId}?fields=status_code,status&access_token=${encodeURIComponent(accessToken)}`,
    );
    const data = (await response.json()) as {
      status_code?: InstagramContainerStatus;
      status?: string;
      error?: GraphError;
    };
    if (!response.ok) {
      throw normaliseInstagramError(data.error, response.status);
    }
    return { status: data.status_code ?? "IN_PROGRESS", error: data.status };
  }

  async publishContainer(
    igUserId: string,
    containerId: string,
    accessToken: string,
  ): Promise<string> {
    return this.post(`/${igUserId}/media_publish`, {
      creation_id: containerId,
      access_token: accessToken,
    });
  }

  async getPermalink(mediaId: string, accessToken: string): Promise<string | null> {
    const response = await fetch(
      `${this.graphBaseUrl}/${mediaId}?fields=permalink&access_token=${encodeURIComponent(accessToken)}`,
    );
    if (!response.ok) return null;
    const data = (await response.json()) as { permalink?: string };
    return data.permalink ?? null;
  }
}

export function toAppError(error: unknown): AppError {
  if (error instanceof InstagramProviderError) {
    if (error.code === "RATE_LIMITED") return new AppError("RATE_LIMITED", error.message);
    if (error.code === "PERMISSION_MISSING") return new AppError("FORBIDDEN", error.message);
    return new AppError("VALIDATION_ERROR", error.message);
  }
  return new AppError("INTERNAL_ERROR", "Instagram publishing failed.", { expose: false });
}
