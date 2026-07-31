import type { PaidAdsQualityWarning } from "@/lib/paid-ads/quality-warnings";

export type CreativeLinkInput = {
  providerCreativeId: string;
  providerAdId?: string;
  contentItemProviderId?: string;
  contentVariantProviderId?: string;
  marketingAssetProviderId?: string;
  explicitContentItemId?: string;
  explicitContentVariantId?: string;
  explicitMarketingAssetId?: string;
};

export type CreativeLinkResult = {
  contentItemId?: string;
  contentVariantId?: string;
  marketingAssetId?: string;
  mappingSource: "EXPLICIT_USER_MAPPING" | "DETERMINISTIC_PROVIDER_ID" | null;
  mappingKey?: string;
};

/**
 * Links creatives only when deterministic provider IDs or explicit user mappings exist.
 * Does not guess identity from similar text.
 */
export function resolveCreativeLink(input: CreativeLinkInput): CreativeLinkResult {
  if (input.explicitContentItemId || input.explicitContentVariantId || input.explicitMarketingAssetId) {
    return {
      contentItemId: input.explicitContentItemId,
      contentVariantId: input.explicitContentVariantId,
      marketingAssetId: input.explicitMarketingAssetId,
      mappingSource: "EXPLICIT_USER_MAPPING",
      mappingKey: input.providerCreativeId,
    };
  }

  if (input.contentVariantProviderId) {
    return {
      contentVariantId: input.contentVariantProviderId,
      mappingSource: "DETERMINISTIC_PROVIDER_ID",
      mappingKey: `variant:${input.contentVariantProviderId}`,
    };
  }

  if (input.contentItemProviderId) {
    return {
      contentItemId: input.contentItemProviderId,
      mappingSource: "DETERMINISTIC_PROVIDER_ID",
      mappingKey: `content:${input.contentItemProviderId}`,
    };
  }

  if (input.marketingAssetProviderId) {
    return {
      marketingAssetId: input.marketingAssetProviderId,
      mappingSource: "DETERMINISTIC_PROVIDER_ID",
      mappingKey: `asset:${input.marketingAssetProviderId}`,
    };
  }

  return { mappingSource: null };
}

export type QualityWarningContext = {
  spend: number;
  conversions: number;
  conversionValue?: number;
  currency?: string;
  lastSyncedAt?: string | null;
  campaignStatus?: string;
  attributionWindow?: string;
  previousSpend?: number;
  syncComplete?: boolean;
};

export function generatePaidAdsQualityWarnings(
  context: QualityWarningContext,
): PaidAdsQualityWarning[] {
  const warnings: PaidAdsQualityWarning[] = [];

  if (context.spend > 100 && context.conversions === 0) {
    warnings.push({
      rule: "spend_without_conversions",
      severity: "medium",
      title: "Spend without conversions",
      description: "Account or campaign has spend but no reported conversions in the selected period.",
    });
  }

  if (context.conversions > 0 && (context.conversionValue ?? 0) === 0) {
    warnings.push({
      rule: "conversions_without_value",
      severity: "low",
      title: "Conversions without value",
      description: "Conversions are reported but conversion value is zero or missing.",
    });
  }

  if (!context.currency) {
    warnings.push({
      rule: "missing_currency",
      severity: "high",
      title: "Missing currency",
      description: "Account currency is not set. Spend cannot be aggregated safely.",
    });
  }

  if (context.lastSyncedAt) {
    const staleDays = (Date.now() - new Date(context.lastSyncedAt).getTime()) / 86_400_000;
    if (staleDays > 3) {
      warnings.push({
        rule: "stale_account",
        severity: "medium",
        title: "Stale account data",
        description: `Last sync was ${Math.floor(staleDays)} days ago.`,
      });
    }
  }

  if (
    context.previousSpend !== undefined &&
    context.previousSpend > 0 &&
    context.spend > context.previousSpend * 2
  ) {
    warnings.push({
      rule: "unexpected_spend_spike",
      severity: "medium",
      title: "Unexpected spend spike",
      description: "Spend more than doubled compared to the prior period.",
    });
  }

  if (context.campaignStatus === "PAUSED" || context.campaignStatus === "REMOVED") {
    warnings.push({
      rule: "disabled_campaign_data",
      severity: "low",
      title: "Disabled campaign receiving data",
      description: "Metrics were reported for a paused or removed campaign — may reflect delayed reporting.",
    });
  }

  if (context.syncComplete === false) {
    warnings.push({
      rule: "incomplete_sync",
      severity: "high",
      title: "Incomplete sync",
      description: "The latest sync did not complete successfully. Data may be partial.",
    });
  }

  return warnings;
}
