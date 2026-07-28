import { OrganisationRole } from "@prisma/client";
import type { TenantContext } from "@/lib/tenancy/context";

export const connectorTestIds = {
  organisationId: "org-connector-1",
  projectId: "project-connector-1",
  brandId: "brand-connector-1",
  userProfileId: "profile-connector-1",
  authUserId: "auth-connector-1",
  connectorAccountId: "account-connector-1",
  connectorDefinitionId: "conn_def_ga4",
};

export const connectorTenantContext: TenantContext = {
  userId: connectorTestIds.authUserId,
  userProfileId: connectorTestIds.userProfileId,
  organisationId: connectorTestIds.organisationId,
  organisationRole: OrganisationRole.OWNER,
};

export function createMockConnectorDefinition(
  overrides: Partial<{
    id: string;
    key: string;
    name: string;
  }> = {},
) {
  return {
    id: overrides.id ?? connectorTestIds.connectorDefinitionId,
    key: "GOOGLE_ANALYTICS_4",
    name: "Google Analytics 4",
    description: "Test connector",
    category: "Analytics",
    requiredScopes: ["https://www.googleapis.com/auth/analytics.readonly"],
    optionalScopes: [],
    supportsOAuth: true,
    platformAvailability: "AVAILABLE",
    documentationUrl: null,
    createdAt: new Date("2025-01-01T00:00:00.000Z"),
    updatedAt: new Date("2025-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

export function createMockConnectorAccount(
  overrides: Partial<{
    id: string;
    status: string;
    connectorType: string;
  }> = {},
) {
  return {
    id: overrides.id ?? connectorTestIds.connectorAccountId,
    organisationId: connectorTestIds.organisationId,
    projectId: connectorTestIds.projectId,
    brandId: connectorTestIds.brandId,
    connectorDefinitionId: connectorTestIds.connectorDefinitionId,
    connectorType: overrides.connectorType ?? "GOOGLE_ANALYTICS_4",
    status: overrides.status ?? "CONNECTED",
    displayName: "Google Analytics 4",
    externalAccountId: "ga-123",
    externalAccountLabel: "Connected GOOGLE_ANALYTICS_4",
    grantedScopes: ["https://www.googleapis.com/auth/analytics.readonly"],
    connectedByUserId: connectorTestIds.userProfileId,
    connectedAt: new Date("2025-01-01T00:00:00.000Z"),
    disconnectedAt: null,
    lastSuccessfulSyncAt: null,
    lastSyncAttemptAt: null,
    lastErrorAt: null,
    lastErrorMessage: null,
    metadata: null,
    createdAt: new Date("2025-01-01T00:00:00.000Z"),
    updatedAt: new Date("2025-01-01T00:00:00.000Z"),
    ...overrides,
  };
}
