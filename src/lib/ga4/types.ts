export type Ga4Account = {
  name: string;
  displayName: string;
  regionCode?: string;
};

export type Ga4Property = {
  name: string;
  displayName: string;
  propertyType: string;
  timeZone?: string;
  currencyCode?: string;
  createTime?: string;
  accountName?: string;
};

export type Ga4PropertyMetadata = {
  propertyId: string;
  displayName: string;
  timeZone: string;
  currencyCode: string;
  propertyType: string;
};

export type Ga4ReportRow = Record<string, string | number | null>;

export type Ga4ReportResult = {
  rows: Ga4ReportRow[];
  rowCount: number;
  dimensionHeaders: string[];
  metricHeaders: string[];
  propertyQuota?: Record<string, unknown>;
};

export type Ga4RealtimeSummary = {
  activeUsers: number;
  fetchedAt: string;
};

export type Ga4SyncCursor = {
  reportKey: string;
  startDate: string;
  endDate: string;
  offset: number;
};

export type Ga4ConnectorMetadata = {
  ga4AccountName?: string;
  ga4AccountDisplayName?: string;
  ga4PropertyName?: string;
  ga4PropertyDisplayName?: string;
  timeZone?: string;
  currencyCode?: string;
  syncState?: {
    backfillStartDate?: string;
    lastSyncedDate?: string;
    lastReconciliationAt?: string;
    initialBackfillComplete?: boolean;
  };
  lastQuota?: Record<string, unknown>;
};
