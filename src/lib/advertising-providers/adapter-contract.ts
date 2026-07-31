/**
 * Common provider adapter contract for controlled ad campaign management.
 * Implementations must gate unavailable capabilities rather than simulate them.
 */

export type ProviderAccountSummary = {
  accountId: string;
  accountName?: string;
  currency?: string;
  timezone?: string;
  isTestAccount?: boolean;
};

export type ProviderAssetSummary = {
  assetType: string;
  assetId: string;
  name?: string;
  metadata?: Record<string, unknown>;
};

export type ProviderDraftPayload = Record<string, unknown>;

export type ProviderMutationOperation = {
  resourceType: string;
  operation: "create" | "update";
  internalRef: string;
  summary: string;
  payload: Record<string, unknown>;
};

export type ProviderMutationPlanPreview = {
  operations: ProviderMutationOperation[];
  resourcesCreated: string[];
  budgetSummary: Record<string, unknown>;
  accountSnapshot: Record<string, unknown>;
  targetingSummary?: Record<string, unknown>;
  creativeSummary?: Record<string, unknown>;
  trackingSummary?: Record<string, unknown>;
  optimisationSummary?: Record<string, unknown>;
  destinationSummary?: Record<string, unknown>;
  providerWarnings: string[];
  risks: string[];
};

export type ProviderValidationResult = {
  valid: boolean;
  errors: string[];
  warnings: string[];
  disclaimer: string;
};

export type ProviderOperationStatus = {
  operationId: string;
  status: string;
  providerResult?: Record<string, unknown>;
  error?: string;
};

export type NormalisedProviderError = {
  code: string;
  message: string;
  recoverable: boolean;
  retryable: boolean;
  requiresReauth: boolean;
  requiresReapproval: boolean;
};

export interface AdvertisingProviderAdapter {
  readonly provider: "LINKEDIN" | "TIKTOK";

  listAccounts(accessToken: string): Promise<ProviderAccountSummary[]>;
  validateAccount(accessToken: string, accountId: string): Promise<ProviderAccountSummary>;
  listAssets(accessToken: string, accountId: string): Promise<ProviderAssetSummary[]>;
  buildDraft(planInput: Record<string, unknown>, account: Record<string, unknown>): ProviderDraftPayload;
  validateDraft(draft: ProviderDraftPayload): ProviderValidationResult;
  createMutationPlan(
    draft: ProviderDraftPayload,
    account: Record<string, unknown>,
  ): ProviderMutationPlanPreview;
  executeApprovedPlan(
    accessToken: string,
    accountId: string,
    operations: ProviderMutationOperation[],
  ): Promise<{ resourceMap: Map<string, string>; providerResponse: Record<string, unknown> }>;
  getOperationStatus(
    accessToken: string,
    accountId: string,
    operationRef: string,
  ): Promise<ProviderOperationStatus>;
  pauseCampaign(accessToken: string, accountId: string, campaignId: string): Promise<Record<string, unknown>>;
  resumeCampaign(accessToken: string, accountId: string, campaignId: string): Promise<Record<string, unknown>>;
  syncCampaign(
    accessToken: string,
    accountId: string,
    campaignId: string,
  ): Promise<Record<string, unknown>>;
  normaliseError(error: unknown): NormalisedProviderError;
}
