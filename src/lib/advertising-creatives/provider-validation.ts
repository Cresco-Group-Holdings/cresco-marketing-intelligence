import type { AdvertisingChannelType, AdvertisingCreativeFormatType } from "@prisma/client";
import { getFormatSpec } from "@/lib/advertising-creatives/format-specs";
import type { CopyFieldResult } from "@/lib/advertising-creatives/copy-limits";

export type ProviderValidationResult = {
  provider: string;
  channelType?: AdvertisingChannelType;
  isLocalPrecheck: true;
  status: "PASSED" | "FAILED" | "WARNING";
  fieldResults: CopyFieldResult[];
  warnings: string[];
  errors: string[];
  disclaimer: string;
};

const DISCLAIMER =
  "Local pre-check only. This is not provider approval. Final acceptance is determined by the advertising platform.";

export function validateProviderCreative(input: {
  provider: string;
  channelType?: AdvertisingChannelType;
  formatType: AdvertisingCreativeFormatType;
  copyFields: CopyFieldResult[];
  assetCount?: number;
  maxAssets?: number;
  hasDestination?: boolean;
  destinationRequired?: boolean;
}): ProviderValidationResult {
  const spec = getFormatSpec(input.formatType);
  const warnings: string[] = [];
  const errors: string[] = [];

  for (const field of input.copyFields) {
    if (!field.valid) {
      errors.push(field.truncationWarning ?? `Field ${field.fieldKey} exceeds limit.`);
    }
  }

  if (input.destinationRequired && !input.hasDestination) {
    errors.push("Destination URL is required for this format.");
  }

  if (input.maxAssets !== undefined && (input.assetCount ?? 0) > input.maxAssets) {
    errors.push(`Asset count ${input.assetCount} exceeds maximum of ${input.maxAssets}.`);
  }

  if (spec.maxDurationSeconds) {
    warnings.push(`Video duration must not exceed ${spec.maxDurationSeconds} seconds.`);
  }

  if (spec.audioRequired) {
    warnings.push("Audio is required for this format.");
  }

  if (spec.subtitlesRequired) {
    warnings.push("Subtitles are recommended for this format.");
  }

  const status = errors.length > 0 ? "FAILED" : warnings.length > 0 ? "WARNING" : "PASSED";

  return {
    provider: input.provider,
    channelType: input.channelType,
    isLocalPrecheck: true,
    status,
    fieldResults: input.copyFields,
    warnings,
    errors,
    disclaimer: DISCLAIMER,
  };
}
