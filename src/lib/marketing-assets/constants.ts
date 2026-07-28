export const MARKETING_ASSET_SIGNED_URL_TTL_SECONDS = 300;

export const MARKETING_ASSET_MAX_SIZE_BYTES = {
  IMAGE: 10 * 1024 * 1024,
  VIDEO: 100 * 1024 * 1024,
  AUDIO: 50 * 1024 * 1024,
  DOCUMENT: 25 * 1024 * 1024,
} as const;

export const MARKETING_ASSET_ALLOWED_MIME_TYPES = {
  IMAGE: ["image/png", "image/jpeg", "image/webp", "image/svg+xml"],
  VIDEO: ["video/mp4", "video/quicktime"],
  AUDIO: ["audio/mpeg", "audio/wav", "audio/mp4", "audio/aac", "audio/ogg", "audio/x-wav"],
  DOCUMENT: ["application/pdf"],
} as const;

export const MARKETING_ASSET_ALLOWED_EXTENSIONS = {
  IMAGE: [".png", ".jpg", ".jpeg", ".webp", ".svg"],
  VIDEO: [".mp4", ".mov"],
  AUDIO: [".mp3", ".wav", ".m4a", ".aac", ".ogg"],
  DOCUMENT: [".pdf"],
} as const;

export const MARKETING_ASSET_BLOCKED_EXTENSIONS = [
  ".exe",
  ".bat",
  ".cmd",
  ".com",
  ".msi",
  ".scr",
  ".js",
  ".mjs",
  ".cjs",
  ".sh",
  ".php",
  ".jar",
  ".app",
  ".dmg",
  ".deb",
  ".rpm",
] as const;

export const MARKETING_ASSET_DEFAULT_BUCKET = "marketing-assets";
