import { getOAuthProviderDefinition } from "@/lib/integrations/oauth/provider-definitions";
import { listProviderCapabilities } from "@/lib/providers/capability-registry";
import {
  buildConnectionHealthView,
  type ConnectionHealthState,
  type ProviderProductAvailability,
} from "@/lib/providers/connection-health";
import { getProviderOAuthConfigDetail } from "@/lib/providers/oauth/provider-config";
import {
  isProductionOAuthProvider,
  PRODUCTION_OAUTH_PROVIDER_KEYS,
} from "@/lib/providers/oauth/production-providers";
import { resolveOAuthProviderKey } from "@/lib/providers/provider-availability";
import { CAPABILITY_MATRIX } from "@/lib/providers/production-readiness";
import { getProviderDefinition } from "@/lib/providers/registry";

/** Cresco implementation completeness — adapter, OAuth, discovery, sync. */
export type EngineeringStatus = "ready" | "beta" | "planned" | "unavailable";

/** Whether production credentials/env are present for this provider. */
export type ConfigurationStatus = "ready" | "misconfigured" | "not_configured" | "disabled";

/** Whether the external provider has approved the Cresco production app. */
export type ExternalApprovalStatus =
  | "approved"
  | "pending_approval"
  | "not_required"
  | "unknown";

/** Whether a customer can connect this provider right now. */
export type CustomerAvailability =
  | "available"
  | "beta"
  | "pending_provider_approval"
  | "not_configured"
  | "coming_soon"
  | "planned"
  | "unavailable";

export type ProviderConnectionStatusView = ConnectionHealthState | "not_connected";

export type ProviderTruthContract = {
  providerKey: string;
  displayName: string;
  engineeringStatus: EngineeringStatus;
  configurationStatus: ConfigurationStatus;
  externalApprovalStatus: ExternalApprovalStatus;
  customerAvailability: CustomerAvailability;
  connectionStatus: ProviderConnectionStatusView;
  capabilities: string[];
};

const TIER_2_POST_LAUNCH = new Set(["tiktok", "google-search-console"]);

function externalApprovalEnvKey(providerKey: string): string {
  return `PROVIDER_${providerKey.toUpperCase().replace(/-/g, "_")}_EXTERNAL_APPROVED`;
}

function resolveExternalApprovalStatus(
  providerKey: string,
  configurationStatus: ConfigurationStatus,
): ExternalApprovalStatus {
  if (configurationStatus !== "ready") {
    return "unknown";
  }

  const definition = getProviderDefinition(providerKey);
  const explicitlyApproved = process.env[externalApprovalEnvKey(providerKey)] === "true";

  if (explicitlyApproved) {
    return "approved";
  }

  if (definition?.requiresApproval) {
    return "pending_approval";
  }

  return "approved";
}

function resolveEngineeringStatus(providerKey: string): EngineeringStatus {
  const oauthKey = resolveOAuthProviderKey(providerKey);

  if (TIER_2_POST_LAUNCH.has(oauthKey)) {
    if (oauthKey === "tiktok") {
      return "planned";
    }
    return isProductionOAuthProvider(oauthKey) ? "beta" : "planned";
  }

  if (!isProductionOAuthProvider(oauthKey)) {
    const definition = getProviderDefinition(providerKey);
    if (!definition) return "unavailable";
    if (definition.apiVersionStatus === "DEPRECATED") return "unavailable";
    return "planned";
  }

  const matrix = CAPABILITY_MATRIX[oauthKey];
  const adapterReady = Boolean(matrix?.accountDiscoveryImplemented && getOAuthProviderDefinition(oauthKey));

  if (!adapterReady) {
    return "unavailable";
  }

  if (oauthKey === "x") {
    return "beta";
  }

  return "ready";
}

function resolveConfigurationStatus(providerKey: string): ConfigurationStatus {
  const oauthKey = resolveOAuthProviderKey(providerKey);

  if (!isProductionOAuthProvider(oauthKey)) {
    return "disabled";
  }

  const config = getProviderOAuthConfigDetail(oauthKey);
  switch (config.status) {
    case "READY":
      return "ready";
    case "MISCONFIGURED":
      return "misconfigured";
    case "DISABLED":
      return "disabled";
    default:
      return "not_configured";
  }
}

function resolveCustomerAvailability(input: {
  providerKey: string;
  engineeringStatus: EngineeringStatus;
  configurationStatus: ConfigurationStatus;
  externalApprovalStatus: ExternalApprovalStatus;
  productAvailability?: ProviderProductAvailability;
}): CustomerAvailability {
  const { providerKey, engineeringStatus, configurationStatus, externalApprovalStatus } = input;

  if (engineeringStatus === "planned") {
    if (providerKey === "tiktok" || resolveOAuthProviderKey(providerKey) === "tiktok") {
      return "unavailable";
    }
    return input.productAvailability === "coming_soon" ? "coming_soon" : "planned";
  }

  if (engineeringStatus === "unavailable") {
    return "unavailable";
  }

  if (configurationStatus === "not_configured" || configurationStatus === "misconfigured") {
    return "not_configured";
  }

  if (configurationStatus === "disabled") {
    return "unavailable";
  }

  if (externalApprovalStatus === "pending_approval") {
    return "pending_provider_approval";
  }

  if (engineeringStatus === "beta") {
    return "beta";
  }

  return "available";
}

export function buildProviderTruthContract(
  providerKey: string,
  options?: {
    connection?: {
      status: string;
      hasSelectedAccount?: boolean;
      initialSyncInProgress?: boolean;
      lastSyncFailed?: boolean;
      stale?: boolean;
      tokenExpired?: boolean;
      lastSuccessfulSyncAt?: Date | string | null;
      lastSyncError?: string | null;
    };
    productAvailability?: ProviderProductAvailability;
  },
): ProviderTruthContract {
  const oauthKey = resolveOAuthProviderKey(providerKey);
  const definition = getProviderDefinition(providerKey) ?? getProviderDefinition(oauthKey);
  const configurationStatus = resolveConfigurationStatus(providerKey);
  const engineeringStatus = resolveEngineeringStatus(providerKey);
  const externalApprovalStatus = resolveExternalApprovalStatus(oauthKey, configurationStatus);

  const customerAvailability = resolveCustomerAvailability({
    providerKey,
    engineeringStatus,
    configurationStatus,
    externalApprovalStatus,
    productAvailability: options?.productAvailability,
  });

  const connectionStatus: ProviderConnectionStatusView = options?.connection
    ? buildConnectionHealthView({
        status: options.connection.status,
        hasSelectedAccount: options.connection.hasSelectedAccount,
        initialSyncInProgress: options.connection.initialSyncInProgress,
        lastSyncFailed: options.connection.lastSyncFailed,
        stale: options.connection.stale,
        tokenExpired: options.connection.tokenExpired,
        lastSuccessfulSyncAt: options.connection.lastSuccessfulSyncAt,
        lastSyncError: options.connection.lastSyncError,
      }).state
    : "not_connected";

  return {
    providerKey,
    displayName: definition?.displayName ?? providerKey,
    engineeringStatus,
    configurationStatus,
    externalApprovalStatus,
    customerAvailability,
    connectionStatus,
    capabilities: listProviderCapabilities(providerKey),
  };
}

export function listLaunchProviderTruthContracts(): ProviderTruthContract[] {
  const keys = new Set<string>([
    ...PRODUCTION_OAUTH_PROVIDER_KEYS,
    "tiktok",
    "instagram",
    "facebook",
    "threads",
    "pinterest",
  ]);

  return [...keys].map((providerKey) => buildProviderTruthContract(providerKey));
}

export function getEngineeringLaunchMinimum(): string[] {
  return listLaunchProviderTruthContracts()
    .filter((row) => row.engineeringStatus === "ready")
    .map((row) => row.providerKey);
}

export function getCustomerConnectableLaunchMinimum(): string[] {
  return listLaunchProviderTruthContracts().filter(
    (row) => row.customerAvailability === "available" || row.customerAvailability === "beta",
  ).map((row) => row.providerKey);
}
