/** Product availability — whether a provider can be connected in production. */
export type ProviderProductAvailability =
  | "available"
  | "beta"
  | "coming_soon"
  | "planned"
  | "unavailable"
  | "not_configured";

/** Per-connection operational state — distinct from product availability. */
export type ConnectionHealthState =
  | "not_connected"
  | "connecting"
  | "connected"
  | "initial_sync"
  | "healthy"
  | "syncing"
  | "stale"
  | "reauthentication_required"
  | "error"
  | "disconnected";

export type DataFreshnessState = "current" | "syncing" | "stale" | "failed" | "unavailable";

export type ConnectionHealthView = {
  state: ConnectionHealthState;
  label: string;
  freshness: DataFreshnessState;
  lastSuccessfulSyncAt: string | null;
  lastSyncError: string | null;
  reconnectRequired: boolean;
  capabilitiesDegraded: boolean;
};

const CONNECTION_STATUS_MAP: Record<string, ConnectionHealthState> = {
  DRAFT: "connecting",
  PENDING: "connecting",
  CONNECTING: "connecting",
  CONNECTED: "connected",
  ACTION_REQUIRED: "reauthentication_required",
  REAUTH_REQUIRED: "reauthentication_required",
  EXPIRED: "reauthentication_required",
  DEGRADED: "error",
  ERROR: "error",
  DISCONNECTED: "disconnected",
  REVOKED: "disconnected",
};

export function mapConnectionStatusToHealthState(
  status: string,
  options?: {
    hasSelectedAccount?: boolean;
    initialSyncInProgress?: boolean;
    lastSyncFailed?: boolean;
    stale?: boolean;
    tokenExpired?: boolean;
  },
): ConnectionHealthState {
  if (options?.tokenExpired || status === "REAUTH_REQUIRED" || status === "ACTION_REQUIRED") {
    return "reauthentication_required";
  }
  if (options?.initialSyncInProgress) return "initial_sync";
  if (options?.lastSyncFailed && status !== "DISCONNECTED") return "error";
  if (options?.stale && status === "CONNECTED") return "stale";
  if (status === "CONNECTED" && options?.hasSelectedAccount) {
    return options.initialSyncInProgress ? "initial_sync" : "healthy";
  }
  return CONNECTION_STATUS_MAP[status] ?? "not_connected";
}

export function connectionHealthLabel(state: ConnectionHealthState): string {
  switch (state) {
    case "not_connected":
      return "Not connected";
    case "connecting":
      return "Connecting";
    case "connected":
      return "Connected";
    case "initial_sync":
      return "Initial sync in progress";
    case "healthy":
      return "Healthy";
    case "syncing":
      return "Syncing";
    case "stale":
      return "Data stale";
    case "reauthentication_required":
      return "Reauthentication required";
    case "error":
      return "Connection error";
    case "disconnected":
      return "Disconnected";
    default:
      return "Unknown";
  }
}

export function mapFreshnessFromHealth(state: ConnectionHealthState): DataFreshnessState {
  switch (state) {
    case "healthy":
    case "connected":
      return "current";
    case "initial_sync":
    case "syncing":
      return "syncing";
    case "stale":
      return "stale";
    case "error":
    case "reauthentication_required":
      return "failed";
    case "not_connected":
    case "disconnected":
    case "connecting":
    default:
      return "unavailable";
  }
}

export function buildConnectionHealthView(input: {
  status: string;
  hasSelectedAccount?: boolean;
  initialSyncInProgress?: boolean;
  lastSyncFailed?: boolean;
  stale?: boolean;
  tokenExpired?: boolean;
  lastSuccessfulSyncAt?: Date | string | null;
  lastSyncError?: string | null;
}): ConnectionHealthView {
  const state = mapConnectionStatusToHealthState(input.status, {
    hasSelectedAccount: input.hasSelectedAccount,
    initialSyncInProgress: input.initialSyncInProgress,
    lastSyncFailed: input.lastSyncFailed,
    stale: input.stale,
    tokenExpired: input.tokenExpired,
  });

  return {
    state,
    label: connectionHealthLabel(state),
    freshness: mapFreshnessFromHealth(state),
    lastSuccessfulSyncAt: input.lastSuccessfulSyncAt
      ? new Date(input.lastSuccessfulSyncAt).toISOString()
      : null,
    lastSyncError: input.lastSyncError ?? null,
    reconnectRequired: state === "reauthentication_required",
    capabilitiesDegraded: state === "error" || state === "reauthentication_required",
  };
}

export type ProviderConnectionHealthInput = {
  status: string;
  hasSelectedAccount?: boolean;
  initialSyncInProgress?: boolean;
  lastSyncFailed?: boolean;
  stale?: boolean;
  tokenExpired?: boolean;
};

export function summarizeProviderConnectionHealthCounts(
  connections: ProviderConnectionHealthInput[],
): {
  reauthRequired: number;
  initialSyncInProgress: number;
} {
  let reauthRequired = 0;
  let initialSyncInProgress = 0;

  for (const connection of connections) {
    const state = mapConnectionStatusToHealthState(connection.status, {
      hasSelectedAccount: connection.hasSelectedAccount,
      initialSyncInProgress: connection.initialSyncInProgress,
      lastSyncFailed: connection.lastSyncFailed,
      stale: connection.stale,
      tokenExpired: connection.tokenExpired,
    });

    if (state === "reauthentication_required") {
      reauthRequired += 1;
    }
    if (state === "initial_sync") {
      initialSyncInProgress += 1;
    }
  }

  return { reauthRequired, initialSyncInProgress };
}
