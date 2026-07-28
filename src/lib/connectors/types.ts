import type {
  ConnectorPlatformAvailability,
  ConnectorStatus,
  ConnectorType,
} from "@prisma/client";

export type ConnectorRegistryEntry = {
  key: ConnectorType;
  name: string;
  description: string;
  category: string;
  requiredScopes: string[];
  optionalScopes: string[];
  supportsOAuth: boolean;
  platformAvailability: ConnectorPlatformAvailability;
  documentationUrl?: string;
};

export type ConnectorAccountSummary = {
  id: string;
  connectorType: ConnectorType;
  status: ConnectorStatus;
  displayName: string | null;
  externalAccountLabel: string | null;
  grantedScopes: string[];
  connectedAt: string | null;
  lastSuccessfulSyncAt: string | null;
  lastErrorAt: string | null;
  lastErrorMessage: string | null;
};

export type ConnectorCatalogueItem = ConnectorRegistryEntry & {
  account: ConnectorAccountSummary | null;
  canConnect: boolean;
  connectDisabledReason: string | null;
};

export type OAuthTokenPair = {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  scopes: string[];
};

export type ConnectorAdapterContext = {
  organisationId: string;
  projectId: string;
  brandId: string;
  connectorAccountId: string;
  connectorType: ConnectorType;
};

export type ConnectorSyncPage<T> = {
  items: T[];
  nextCursor?: string;
};

export type ConnectorSyncResult = {
  recordsProcessed: number;
  recordsFailed: number;
  partialFailure: boolean;
  nextCursor?: string;
};
