import { describe, expect, it } from "vitest";
import {
  buildDigitalAssetStorageKey,
  processDigitalAssetUpload,
} from "@/lib/digital-assets/file-processing";

describe("digital asset file processing", () => {
  it("rejects executable uploads", async () => {
    await expect(processDigitalAssetUpload("virus.exe", Buffer.from("bad"))).rejects.toThrow(/not allowed/i);
  });

  it("computes checksum on valid png upload", async () => {
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64",
    );
    const result = await processDigitalAssetUpload("pixel.png", png);
    expect(result.checksum).toMatch(/^[a-f0-9]{64}$/);
    expect(result.assetType).toBe("IMAGE");
    expect(result.width).toBe(1);
  });

  it("prevents path traversal in storage keys", () => {
    const key = buildDigitalAssetStorageKey("org-1", "brand-1", "asset-1", "../../secret.png");
    expect(key).not.toContain("..");
  });
});
