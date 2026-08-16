import { describe, expect, it } from "vitest";
import {
  evaluateMediaReadiness,
  isProviderAccessibleUrl,
  classifyInstagramMediaType,
} from "@/lib/publishing/media-readiness";

describe("media readiness", () => {
  it("rejects localhost and non-https media URLs", () => {
    expect(isProviderAccessibleUrl("https://cdn.example.com/image.jpg")).toBe(true);
    expect(isProviderAccessibleUrl("http://cdn.example.com/image.jpg")).toBe(false);
    expect(isProviderAccessibleUrl("https://localhost/image.jpg")).toBe(false);
  });

  it("classifies instagram media types", () => {
    expect(classifyInstagramMediaType([{ assetType: "IMAGE" }])).toBe("IMAGE");
    expect(
      classifyInstagramMediaType([{ assetType: "IMAGE" }, { assetType: "IMAGE" }]),
    ).toBe("CAROUSEL");
    expect(classifyInstagramMediaType([{ assetType: "VIDEO" }])).toBe("REELS");
  });

  it("requires approved ready assets", () => {
    const result = evaluateMediaReadiness({
      assets: [
        {
          id: "a1",
          status: "READY",
          approvedForMarketing: false,
          assetType: "IMAGE",
          licenceExpiresAt: null,
          mimeType: "image/jpeg",
        },
      ],
      signedUrls: ["https://cdn.example.com/a.jpg"],
    });
    expect(result.ready).toBe(false);
    expect(result.issues.some((issue) => issue.code === "ASSET_NOT_APPROVED")).toBe(true);
  });

  it("passes when assets and URLs are provider-ready", () => {
    const result = evaluateMediaReadiness({
      assets: [
        {
          id: "a1",
          status: "READY",
          approvedForMarketing: true,
          assetType: "IMAGE",
          licenceExpiresAt: null,
          mimeType: "image/jpeg",
        },
      ],
      signedUrls: ["https://cdn.example.com/a.jpg"],
    });
    expect(result.ready).toBe(true);
    expect(result.mediaType).toBe("IMAGE");
  });
});
