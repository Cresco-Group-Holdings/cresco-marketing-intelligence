import path from "node:path";
import FileType from "file-type";
import { AppError } from "@/lib/errors";
import { loadSharp } from "@/lib/images/sharp-loader";
import {
  MARKETING_ASSET_ALLOWED_EXTENSIONS,
  MARKETING_ASSET_ALLOWED_MIME_TYPES,
  MARKETING_ASSET_BLOCKED_EXTENSIONS,
  MARKETING_ASSET_MAX_SIZE_BYTES,
} from "@/lib/marketing-assets/constants";
import { createMalwareScanner } from "@/lib/marketing-assets/malware-scanner";
import { sanitizeSvgContent } from "@/lib/marketing-assets/svg-sanitizer";
import type { MarketingAssetType } from "@prisma/client";

export type ProcessedUpload = {
  buffer: Buffer;
  mimeType: string;
  assetType: MarketingAssetType;
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
  safeFilename: string;
};

function extensionFromFilename(filename: string): string {
  return path.extname(filename).toLowerCase();
}

function inferAssetTypeFromMime(mimeType: string): MarketingAssetType | null {
  if ((MARKETING_ASSET_ALLOWED_MIME_TYPES.IMAGE as readonly string[]).includes(mimeType)) return "IMAGE";
  if ((MARKETING_ASSET_ALLOWED_MIME_TYPES.VIDEO as readonly string[]).includes(mimeType)) return "VIDEO";
  if ((MARKETING_ASSET_ALLOWED_MIME_TYPES.AUDIO as readonly string[]).includes(mimeType)) return "AUDIO";
  if ((MARKETING_ASSET_ALLOWED_MIME_TYPES.DOCUMENT as readonly string[]).includes(mimeType)) return "DOCUMENT";
  return null;
}

function isExtensionAllowed(extension: string, assetType: MarketingAssetType): boolean {
  return (MARKETING_ASSET_ALLOWED_EXTENSIONS[assetType] as readonly string[]).includes(extension);
}

function maxSizeForAssetType(assetType: MarketingAssetType): number {
  return MARKETING_ASSET_MAX_SIZE_BYTES[assetType];
}

function sanitiseFilename(filename: string): string {
  const base = path.basename(filename).replace(/[^a-zA-Z0-9._-]/g, "_");
  return base.length > 0 ? base.slice(0, 180) : "asset";
}

export async function processMarketingAssetUpload(
  filename: string,
  buffer: Buffer,
): Promise<ProcessedUpload> {
  const extension = extensionFromFilename(filename);
  if ((MARKETING_ASSET_BLOCKED_EXTENSIONS as readonly string[]).includes(extension)) {
    throw new AppError("VALIDATION_ERROR", "Executable or unsupported file types are not allowed.");
  }

  const detected = await FileType.fromBuffer(buffer);
  let mimeType: string | null = detected?.mime ?? null;
  if (!mimeType && extension === ".svg") {
    mimeType = "image/svg+xml";
  }

  if (!mimeType) {
    throw new AppError("VALIDATION_ERROR", "Unable to determine file type.");
  }

  const assetType = inferAssetTypeFromMime(mimeType);
  if (!assetType) {
    throw new AppError("VALIDATION_ERROR", "Unsupported file type.");
  }

  if (!isExtensionAllowed(extension, assetType)) {
    throw new AppError("VALIDATION_ERROR", "File extension does not match supported asset types.");
  }

  if (buffer.byteLength > maxSizeForAssetType(assetType)) {
    throw new AppError("VALIDATION_ERROR", "File exceeds the maximum allowed upload size.");
  }

  const malwareScanner = createMalwareScanner();
  const scanResult = await malwareScanner.scan(buffer, mimeType);
  if (!scanResult.clean) {
    throw new AppError("VALIDATION_ERROR", scanResult.reason ?? "File failed malware scan.");
  }

  let processedBuffer = buffer;
  let width: number | null = null;
  let height: number | null = null;

  if (mimeType === "image/svg+xml") {
    const sanitized = sanitizeSvgContent(buffer.toString("utf8"));
    processedBuffer = Buffer.from(sanitized, "utf8");
  } else if (assetType === "IMAGE") {
    const sharp = await loadSharp();
    const image = sharp(processedBuffer, { failOn: "error" });
    const metadata = await image.metadata();
    width = metadata.width ?? null;
    height = metadata.height ?? null;
    processedBuffer = await image.rotate().toBuffer();
  }

  return {
    buffer: processedBuffer,
    mimeType,
    assetType,
    width,
    height,
    durationSeconds: null,
    safeFilename: sanitiseFilename(filename),
  };
}

export function buildMarketingAssetStorageKey(
  organisationId: string,
  brandId: string,
  assetId: string,
  filename: string,
): string {
  return `${organisationId}/${brandId}/${assetId}/${filename}`;
}
