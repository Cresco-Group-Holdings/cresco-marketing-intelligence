import { describe, expect, it } from "vitest";
import { OrganisationRole } from "@prisma/client";
import { hasPermission, PERMISSIONS } from "@/lib/tenancy/permissions";
import { sanitizeSvgContent } from "@/lib/marketing-assets/svg-sanitizer";
import { processMarketingAssetUpload } from "@/lib/marketing-assets/file-processing";

describe("marketing asset permissions", () => {
  it("allows marketers to upload assets", () => {
    expect(hasPermission(OrganisationRole.MARKETER, PERMISSIONS["marketingAssets.update"])).toBe(true);
  });

  it("denies viewers from uploading assets", () => {
    expect(hasPermission(OrganisationRole.VIEWER, PERMISSIONS["marketingAssets.update"])).toBe(false);
  });

  it("allows analysts to read marketing assets", () => {
    expect(hasPermission(OrganisationRole.ANALYST, PERMISSIONS["marketingAssets.read"])).toBe(true);
  });
});

describe("svg sanitisation", () => {
  it("accepts a simple svg", () => {
    const result = sanitizeSvgContent('<svg viewBox="0 0 10 10"><rect width="10" height="10"/></svg>');
    expect(result).toContain("<svg");
  });

  it("rejects svg with script tags", () => {
    expect(() => sanitizeSvgContent('<svg><script>alert(1)</script></svg>')).toThrow(
      /disallowed content/i,
    );
  });

  it("rejects svg with event handlers", () => {
    expect(() => sanitizeSvgContent('<svg onload="alert(1)"></svg>')).toThrow(/disallowed content/i);
  });
});

describe("processMarketingAssetUpload", () => {
  it("rejects executable extensions", async () => {
    await expect(
      processMarketingAssetUpload("malware.exe", Buffer.from("MZ")),
    ).rejects.toThrow(/not allowed/i);
  });

  it("rejects unsupported mime types", async () => {
    await expect(
      processMarketingAssetUpload("notes.txt", Buffer.from("plain text")),
    ).rejects.toThrow(/Unable to determine file type/i);
  });

  it("accepts png uploads and strips metadata via re-encoding", async () => {
    const pngHeader = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
      0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
      0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
      0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
      0x42, 0x60, 0x82,
    ]);

    const processed = await processMarketingAssetUpload("logo.png", pngHeader);
    expect(processed.mimeType).toBe("image/png");
    expect(processed.assetType).toBe("IMAGE");
    expect(processed.buffer.byteLength).toBeGreaterThan(0);
  });
});
