import type {
  DataLineageEntityType,
  MarketingDataProvider,
  RawMarketingRecordStatus,
} from "@prisma/client";

export type RawRecordContext = {
  organisationId: string;
  projectId: string;
  brandId: string;
  marketingDataSourceAccountId: string;
  provider: MarketingDataProvider;
  batchId?: string;
};

export type RawRecordInput = {
  providerRecordId: string;
  recordType: string;
  eventTime?: Date;
  payload: Record<string, unknown>;
  metadata?: Record<string, unknown>;
};

export type ValidationResult =
  | { valid: true; record: RawRecordInput }
  | { valid: false; errors: string[] };

export type NormalisedDimension = {
  entityType:
    | "channel"
    | "account"
    | "campaign"
    | "ad_group"
    | "ad"
    | "creative"
    | "content"
    | "search_query"
    | "landing_page"
    | "geography"
    | "device";
  providerId: string;
  name: string;
  metadata?: Record<string, unknown>;
};

export type NormalisedCostRecord = {
  providerCostId: string;
  amount: number;
  currency: string;
  periodStart: Date;
  periodEnd: Date;
  dimensionProviderIds?: {
    account?: string;
    campaign?: string;
    adGroup?: string;
    ad?: string;
    creative?: string;
  };
  metadata?: Record<string, unknown>;
};

export type NormalisedMetric = {
  metricKey: string;
  metricValue: number;
  observedAt: Date;
  dimensions?: Record<string, unknown>;
  grain?: "query" | "page" | "query_page" | "device" | "country" | "aggregate";
  dimensionProviderIds?: {
    searchQuery?: string;
    landingPage?: string;
    geography?: string;
    device?: string;
    account?: string;
    campaign?: string;
    adGroup?: string;
    ad?: string;
    creative?: string;
  };
};

export type NormalisedEvent = {
  providerEventId: string;
  eventName: string;
  occurredAt: Date;
  properties?: Record<string, unknown>;
};

export type NormalisationResult = {
  status: RawMarketingRecordStatus;
  metrics: NormalisedMetric[];
  events: NormalisedEvent[];
  dimensions: NormalisedDimension[];
  costRecords?: NormalisedCostRecord[];
  errors?: string[];
};

export type QualityIssue = {
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  entityType: string;
  entityId: string;
  message: string;
  details?: Record<string, unknown>;
};

export interface RawRecordValidator {
  readonly provider: MarketingDataProvider;
  validate(record: RawRecordInput): ValidationResult;
}

export interface RawRecordNormaliser {
  readonly provider: MarketingDataProvider;
  normalise(record: RawRecordInput, context: RawRecordContext): Promise<NormalisationResult>;
}

export interface DimensionResolver {
  resolve(
    dimension: NormalisedDimension,
    context: RawRecordContext,
  ): Promise<{ id: string; created: boolean }>;
}

export interface MetricMapper {
  mapMetric(
    metric: NormalisedMetric,
    context: RawRecordContext,
  ): Promise<{ metricKey: string; definitionId?: string }>;
}

export interface EventMapper {
  mapEvent(
    event: NormalisedEvent,
    context: RawRecordContext,
  ): Promise<{ eventName: string; idempotencyKey: string }>;
}

export interface DataQualityEvaluator {
  evaluate(
    entityType: string,
    entityId: string,
    data: Record<string, unknown>,
  ): QualityIssue[];
}

export interface LineageRecorder {
  record(input: {
    context: RawRecordContext;
    entityType: DataLineageEntityType;
    entityId: string;
    parentEntityType?: DataLineageEntityType;
    parentEntityId?: string;
    rawMarketingRecordId?: string;
    metadata?: Record<string, unknown>;
  }): Promise<void>;
}
