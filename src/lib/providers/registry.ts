import type { ProviderDefinition, ProviderKey, ProviderConfiguration } from "@/lib/providers/types";
import type { ProviderCapabilityType } from "@prisma/client";
import { PROVIDER_DEFINITIONS } from "@/lib/providers/definitions";

const definitionMap = new Map<ProviderKey, ProviderDefinition>(
  PROVIDER_DEFINITIONS.map((definition) => [definition.key, definition]),
);

export function getProviderDefinition(providerKey: string): ProviderDefinition | undefined {
  return definitionMap.get(providerKey as ProviderKey);
}

export function listProviderDefinitions(): ProviderDefinition[] {
  return [...PROVIDER_DEFINITIONS];
}

export function listEnabledProviders(): ProviderDefinition[] {
  return PROVIDER_DEFINITIONS.filter((definition) => definition.enabled);
}

export function supportsCapability(providerKey: string, capability: ProviderCapabilityType): boolean {
  const definition = getProviderDefinition(providerKey);
  return definition?.capabilities.includes(capability) ?? false;
}

export function getProviderAuthType(providerKey: string) {
  return getProviderDefinition(providerKey)?.authType;
}

export function getProviderApiVersion(providerKey: string): string | undefined {
  return getProviderDefinition(providerKey)?.apiVersion;
}

export function validateProviderConfiguration(
  providerKey: string,
  configuration: ProviderConfiguration,
): { valid: boolean; errors: string[] } {
  const definition = getProviderDefinition(providerKey);
  if (!definition) {
    return { valid: false, errors: [`Unknown provider: ${providerKey}`] };
  }

  const errors: string[] = [];
  for (const field of definition.requiredConfigFields) {
    const value = configuration[field];
    if (value === undefined || value === null || value === "") {
      errors.push(`Missing required field: ${field}`);
    }
  }

  return { valid: errors.length === 0, errors };
}

export function getRequiredOAuthScopes(providerKey: string, capability?: ProviderCapabilityType): string[] {
  const definition = getProviderDefinition(providerKey);
  if (!definition?.oauthScopes) {
    return [];
  }
  if (capability && definition.oauthScopes[capability]) {
    return definition.oauthScopes[capability];
  }
  return definition.oauthScopes.default ?? [];
}

export function getProviderFeatureFlags(providerKey: string): Record<string, boolean> {
  return getProviderDefinition(providerKey)?.featureFlags ?? {};
}

export function resolveProviderAdapter(_providerKey: string, _capability?: ProviderCapabilityType): null {
  // Live adapters are registered in Task 7.2+. Foundation returns null for disabled providers.
  return null;
}
