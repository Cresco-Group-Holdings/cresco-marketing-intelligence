import type { OutboundOperationType } from "@/lib/publishing/outbound-operations";

export type AdaptationIssueSeverity = "ERROR" | "WARNING" | "INFO";

export type AdaptationIssue = {
  code: string;
  severity: AdaptationIssueSeverity;
  message: string;
  field?: string;
  requiresConfirmation?: boolean;
};

export type ContentAdaptationInput = {
  providerKey: string;
  operationType: OutboundOperationType;
  caption?: string | null;
  hashtags?: string[];
  destinationUrl?: string | null;
  imageCount?: number;
  videoDurationSeconds?: number;
  subject?: string | null;
  preheader?: string | null;
};

export type ContentAdaptationResult = {
  valid: boolean;
  adaptedPayload: Record<string, unknown>;
  issues: AdaptationIssue[];
  warnings: AdaptationIssue[];
};

const PROVIDER_LIMITS: Record<
  string,
  { maxCaption?: number; maxHashtags?: number; maxSubject?: number; maxPreheader?: number; maxVideoSeconds?: number }
> = {
  "mock-advertising": { maxCaption: 5000, maxHashtags: 30 },
  "mock-crm": { maxCaption: 5000 },
  instagram: { maxCaption: 2200, maxHashtags: 30 },
  linkedin: { maxCaption: 3000, maxHashtags: 5 },
  tiktok: { maxCaption: 2200, maxVideoSeconds: 600 },
  x: { maxCaption: 280, maxHashtags: 10 },
  meta: { maxCaption: 5000 },
  resend: { maxSubject: 998, maxPreheader: 250 },
};

export function adaptContentForProvider(input: ContentAdaptationInput): ContentAdaptationResult {
  const limits = PROVIDER_LIMITS[input.providerKey] ?? PROVIDER_LIMITS[input.providerKey.split("-")[0] ?? ""] ?? {};
  const issues: AdaptationIssue[] = [];
  const warnings: AdaptationIssue[] = [];
  const adaptedPayload: Record<string, unknown> = {
    caption: input.caption ?? "",
    hashtags: input.hashtags ?? [],
    destinationUrl: input.destinationUrl ?? null,
  };

  if (input.caption && limits.maxCaption && input.caption.length > limits.maxCaption) {
    issues.push({
      code: "CAPTION_TOO_LONG",
      severity: "ERROR",
      message: `Caption exceeds ${limits.maxCaption} characters for ${input.providerKey}.`,
      field: "caption",
    });
  }

  if (input.hashtags && limits.maxHashtags && input.hashtags.length > limits.maxHashtags) {
    issues.push({
      code: "TOO_MANY_HASHTAGS",
      severity: "ERROR",
      message: `Maximum ${limits.maxHashtags} hashtags allowed.`,
      field: "hashtags",
    });
  }

  if (input.subject && limits.maxSubject && input.subject.length > limits.maxSubject) {
    issues.push({
      code: "SUBJECT_TOO_LONG",
      severity: "ERROR",
      message: `Subject exceeds ${limits.maxSubject} characters.`,
      field: "subject",
    });
  }

  if (input.preheader && limits.maxPreheader && input.preheader.length > limits.maxPreheader) {
    warnings.push({
      code: "PREHEADER_TRUNCATED",
      severity: "WARNING",
      message: `Preheader exceeds ${limits.maxPreheader} characters and may be truncated by the provider.`,
      field: "preheader",
      requiresConfirmation: true,
    });
  }

  if (
    input.videoDurationSeconds &&
    limits.maxVideoSeconds &&
    input.videoDurationSeconds > limits.maxVideoSeconds
  ) {
    issues.push({
      code: "VIDEO_TOO_LONG",
      severity: "ERROR",
      message: `Video exceeds ${limits.maxVideoSeconds} seconds.`,
      field: "videoDurationSeconds",
    });
  }

  if (input.operationType.includes("IMAGE") && (input.imageCount ?? 0) === 0) {
    issues.push({
      code: "MISSING_IMAGE_ASSET",
      severity: "ERROR",
      message: "At least one image asset is required for this operation.",
      field: "imageCount",
    });
  }

  if (input.operationType.includes("VIDEO") && !input.videoDurationSeconds) {
    issues.push({
      code: "MISSING_VIDEO_ASSET",
      severity: "ERROR",
      message: "A video asset is required for this operation.",
      field: "videoDurationSeconds",
    });
  }

  if (input.destinationUrl && !/^https?:\/\//i.test(input.destinationUrl)) {
    issues.push({
      code: "UNSUPPORTED_LINK",
      severity: "ERROR",
      message: "Destination URL must use http or https.",
      field: "destinationUrl",
    });
  }

  return {
    valid: issues.length === 0,
    adaptedPayload,
    issues,
    warnings,
  };
}
