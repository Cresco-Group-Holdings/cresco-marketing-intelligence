export const DIGITAL_ASSET_SIGNED_URL_TTL_SECONDS = 300;

export const DIGITAL_ASSET_STORAGE_PROVIDER = "supabase";

export const DIGITAL_ASSET_MAX_SIZE_BYTES: Record<string, number> = {
  IMAGE: 10 * 1024 * 1024,
  VIDEO: 100 * 1024 * 1024,
  AUDIO: 50 * 1024 * 1024,
  DOCUMENT: 25 * 1024 * 1024,
  DEFAULT: 25 * 1024 * 1024,
};

export const DIGITAL_ASSET_ALLOWED_MIME_TYPES = {
  IMAGE: ["image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml"],
  VIDEO: ["video/mp4", "video/webm", "video/quicktime"],
  AUDIO: ["audio/mpeg", "audio/mp4", "audio/wav", "audio/ogg"],
  DOCUMENT: [
    "application/pdf",
    "text/plain",
    "text/markdown",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ],
} as const;

export const DIGITAL_ASSET_BLOCKED_EXTENSIONS = [
  ".exe",
  ".bat",
  ".cmd",
  ".com",
  ".msi",
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
  ".php",
  ".sh",
  ".ps1",
  ".vbs",
  ".jar",
  ".html",
  ".htm",
] as const;

export const DIGITAL_ASSET_TYPE_LABELS: Record<string, string> = {
  IMAGE: "Image",
  VIDEO: "Video",
  AUDIO: "Audio",
  DOCUMENT: "Document",
  LOGO: "Logo",
  TEMPLATE: "Template",
  AD_CREATIVE: "Ad creative",
  SOCIAL_CREATIVE: "Social creative",
  OTHER: "Other",
};

export const DIGITAL_ASSET_STATUS_LABELS: Record<string, string> = {
  UPLOADING: "Uploading",
  PROCESSING: "Processing",
  READY: "Ready",
  FAILED: "Failed",
  ARCHIVED: "Archived",
};

export const DIGITAL_ASSET_PROCESSING_JOB_TYPES = [
  "CHECKSUM",
  "METADATA",
  "THUMBNAIL",
  "SAFETY_VALIDATION",
  "PREVIEW",
] as const;

export const DIGITAL_ASSET_PROCESSING_BATCH_SIZE = 20;
