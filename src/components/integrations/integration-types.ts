export type ProviderCatalogueItem = {
  key: string;
  displayName: string;
  category: string;
  authTypes: string[];
  status: string;
  defaultApiVersion?: string;
  documentationUrl?: string;
  supportsWebhooks: boolean;
  supportsPolling: boolean;
  supportsPush: boolean;
  capabilities: string[];
};

export type IntegrationConnectionView = {
  id: string;
  providerKey: string;
  displayName: string | null;
  status: string;
  environment: string;
  lastHealthCheckAt: string | null;
  lastSuccessfulAt: string | null;
  reauthorizationRequired: boolean;
  externalLabel?: string | null;
  providerVersion?: string | null;
};

export type ProviderAccountView = {
  id: string;
  externalId: string;
  displayName: string;
  accountType?: string | null;
  currency?: string | null;
  timezone?: string | null;
  status?: string | null;
  selected: boolean;
};

export type SyncJobView = {
  id: string;
  capability: string | null;
  resourceType: string | null;
  direction: string;
  status: string;
  triggerType: string;
  recordsRead: number;
  recordsWritten: number;
  recordsSkipped: number;
  recordsFailed: number;
  attemptCount: number;
  errorCode?: string | null;
  errorMessage?: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
};

export type ConnectionHealthView = {
  status: string;
  checkedAt: string;
  capabilitiesAvailable: string[];
  capabilitiesUnavailable: string[];
  warnings: Array<{ code: string; message: string }>;
};
