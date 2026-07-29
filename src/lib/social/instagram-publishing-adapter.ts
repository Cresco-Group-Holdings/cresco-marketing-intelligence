import { AppError } from "@/lib/errors";

export type InstagramPublishInput = {
  igUserId: string; accessToken: string; caption?: string; mediaUrls: string[]; mediaType: "IMAGE" | "CAROUSEL" | "REELS"; altText?: string;
};
export class InstagramPublishingAdapter {
  constructor(private readonly graphBaseUrl = "https://graph.facebook.com/v22.0") {}
  async publish(input: InstagramPublishInput) {
    const create = async (body: Record<string, string>) => {
      const response = await fetch(`${this.graphBaseUrl}/${input.igUserId}/media`, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ ...body, access_token: input.accessToken }) });
      const data = await response.json() as { id?: string; error?: { code?: number; message?: string } };
      if (!response.ok || !data.id) throw this.error(data.error);
      return data.id;
    };
    const childIds = input.mediaType === "CAROUSEL" ? await Promise.all(input.mediaUrls.map((url) => create({ image_url: url, is_carousel_item: "true" }))) : [];
    const containerId = input.mediaType === "CAROUSEL" ? await create({ media_type: "CAROUSEL", children: childIds.join(","), caption: input.caption ?? "" }) : await create({ [input.mediaType === "REELS" ? "video_url" : "image_url"]: input.mediaUrls[0]!, media_type: input.mediaType === "REELS" ? "REELS" : "IMAGE", caption: input.caption ?? "", ...(input.altText && input.mediaType === "IMAGE" ? { alt_text: input.altText } : {}) });
    const published = await fetch(`${this.graphBaseUrl}/${input.igUserId}/media_publish`, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ creation_id: containerId, access_token: input.accessToken }) });
    const result = await published.json() as { id?: string; error?: { code?: number; message?: string } };
    if (!published.ok || !result.id) throw this.error(result.error);
    const media = await fetch(`${this.graphBaseUrl}/${result.id}?fields=permalink&access_token=${encodeURIComponent(input.accessToken)}`);
    const details = await media.json() as { permalink?: string };
    return { containerId, postId: result.id, permalink: details.permalink ?? null };
  }
  private error(error?: { code?: number; message?: string }) {
    const message = error?.message ?? "Instagram publishing failed.";
    if (/token/i.test(message)) return new AppError("VALIDATION_ERROR", "Instagram token expired or is invalid.");
    if (/permission/i.test(message)) return new AppError("FORBIDDEN", "Instagram publishing permission is missing.");
    if (/rate/i.test(message)) return new AppError("RATE_LIMITED", "Instagram rate limit reached.");
    return new AppError("VALIDATION_ERROR", message);
  }
}
