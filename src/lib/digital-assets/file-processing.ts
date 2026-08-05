import path from "node:path";
import FileType from "file-type";
import { AppError } from "@/lib/errors";
import { loadSharp } from "@/lib/images/sharp-loader";
import { createMalwareScanner } from "@/lib/marketing-assets/malware-scanner";
import { sanitizeSvgContent } from "@/lib/marketing-assets/svg-sanitizer";
import { computeAssetChecksum } from "@/lib/digital-assets/checksum";
import {
  DIGITAL_ASSET_ALLOWED_MIME_TYPES,
  DIGITAL_ASSET_BLOCKED_EXTENSIONS,
  DIGITAL_ASSET_MAX_SIZE_BYTES,
} from "@/lib/digital-assets/constants";
import type { DigitalAssetType } from "@prisma/client";

export type ProcessedDigitalAssetUpload = {
  buffer: Buffer;
  mimeType: string;
  safeFilename: string;
  checksum: string;
  assetType: DigitalAssetType;
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
};

function extensionFromFilename(filename: string): string {
  return path.extname(filename).toLowerCase();
}

function sanitiseFilename(filename: string): string {
  const base = path.basename(filename).replace(/\.\./g, "").replace(/[^a-zA-Z0-9._-]/g, "_");
  return base.length > 0 ? base.slice(0, 180) : "asset";
}

function inferAssetType(mimeType: string, explicitType?: DigitalAssetType): DigitalAssetType {
  if (explicitType) return explicitType;
  if ((DIGITAL_ASSET_ALLOWED_MIME_TYPES.IMAGE as readonly string[]).includes(mimeType)) return "IMAGE";
  if ((DIGITAL_ASSET_ALLOWED_MIME_TYPES.VIDEO as readonly string[]).includes(mimeType)) return "VIDEO";
  if ((DIGITAL_ASSET_ALLOWED_MIME_TYPES.AUDIO as readonly string[]).includes(mimeType)) return "AUDIO";
  if ((DIGITAL_ASSET_ALLOWED_MIME_TYPES.DOCUMENT as readonly string[]).includes(mimeType)) return "DOCUMENT";
  return "OTHER";
}

function maxSizeForType(assetType: DigitalAssetType): number {
  if (assetType === "LOGO" || assetType === "TEMPLATE" || assetType === "AD_CREATIVE" || assetType === "SOCIAL_CREATIVE") {
    return DIGITAL_ASSET_MAX_SIZE_BYTES.IMAGE;
  }
  return DIGITAL_ASSET_MAX_SIZE_BYTES[assetType as keyof typeof DIGITAL_ASSET_MAX_SIZE_BYTES] ?? DIGITAL_ASSET_MAX_SIZE_BYTES.DEFAULT;
}

export function buildDigitalAssetStorageKey(
  organisationId: string,
  brandId: string | null,
  assetId: string,
  filename: string,
  version = 1,
): string {
  const scope = brandId ?? "org";
  const safe = sanitiseFilename(filename);
  return `${organisationId}/${scope}/dam/${assetId}/v${version}/${safe}`;
}

export function buildDigitalAssetThumbnailKey(
  organisationId: string,
  brandId: string | null,
  assetId: string,
): string {
  const scope = brandId ?? "org";
  return `${organisationId}/${scope}/dam/${assetId}/thumb.webp`;
}

export async function processDigitalAssetUpload(
  filename: string,
  buffer: Buffer,
  explicitType?: DigitalAssetType,
): Promise<ProcessedDigitalAssetUpload> {
  const extension = extensionFromFilename(filename);
  if ((DIGITAL_ASSET_BLOCKED_EXTENSIONS as readonly string[]).includes(extension)) {
    throw new AppError("VALIDATION_ERROR", "Executable or unsupported file types are not allowed.");
  }

  const detected = await FileType.fromBuffer(buffer);
  let mimeType = detected?.mime ?? null;
  if (!mimeType && extension === ".svg") mimeType = "image/svg+xml";
  if (!mimeType && (extension === ".txt" || extension === ".md")) mimeType = "text/plain";

  if (!mimeType) {
    throw new AppError("VALIDATION_ERROR", "Unable to determine file type.");
  }

  const assetType = inferAssetType(mimeType, explicitType);

  if (buffer.byteLength > maxSizeForType(assetType)) {
    throw new AppError("VALIDATION_ERROR", "File exceeds the maximum allowed upload size.");
  }

  const malwareScanner = createMalwareScanner();
  const scanResult = await malwareScanner.scan(buffer, mimeType);
  if (!scanResult.clean) {
    throw new AppError("VALIDATION_ERROR", scanResult.reason ?? "File failed security scan.");
  }

  let processedBuffer = buffer;
  let width: number | null = null;
  let height: number | null = null;

  if (mimeType === "image/svg+xml") {
    processedBuffer = Buffer.from(sanitizeSvgContent(buffer.toString("utf8")), "utf8");
  } else if ((DIGITAL_ASSET_ALLOWED_MIME_TYPES.IMAGE as readonly string[]).includes(mimeType)) {
    const sharp = await loadSharp();
    const image = sharp(processedBuffer, { failOn: "error" });
    const metadata = await image.metadata();
    width = metadata.width ?? null;
    height = metadata.height ?? null;
    if (mimeType !== "image/gif") {
      processedBuffer = await image.rotate().toBuffer();
    }
  }

  return {
    buffer: processedBuffer,
    mimeType,
    safeFilename: sanitiseFilename(filename),
    checksum: computeAssetChecksum(processedBuffer),
    assetType,
    width,
    height,
    durationSeconds: null,
  };
}
