import { getServerEnv } from "@/lib/environment";

export type ProviderPlatformFlags = {
  connectorsEnabled: boolean;
  liveCallsEnabled: boolean;
};

export function getProviderPlatformFlags(): ProviderPlatformFlags {
  const env = getServerEnv();
  return {
    connectorsEnabled: env.PROVIDER_CONNECTORS_ENABLED !== "false",
    liveCallsEnabled: env.PROVIDER_LIVE_CALLS_ENABLED === "true",
  };
}

export function isProviderConnectorsEnabled(): boolean {
  return getProviderPlatformFlags().connectorsEnabled;
}

export function isProviderLiveCallsEnabled(): boolean {
  return getProviderPlatformFlags().liveCallsEnabled;
}

export function assertProviderConnectorsEnabled(): void {
  if (!isProviderConnectorsEnabled()) {
    throw new Error("Provider connectors are disabled.");
  }
}

export function assertProviderLiveCallsEnabled(): void {
  if (!isProviderLiveCallsEnabled()) {
    throw new Error("Provider live calls are disabled.");
  }
}
