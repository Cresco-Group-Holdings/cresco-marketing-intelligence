import { CAPABILITY_SCOPE_MAP } from "@/lib/integrations/oauth/constants";
import type { ProviderCapabilityType } from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import { getOAuthProviderDefinition } from "@/lib/integrations/oauth/provider-definitions";
import { getProviderDefinition } from "@/lib/providers/registry";

export type ScopeResolution = {
  requestedScopes: string[];
  grantedScopes: string[];
  missingScopes: string[];
  optionalScopes: string[];
  supportedCapabilities: ProviderCapabilityType[];
  unsupportedCapabilities: ProviderCapabilityType[];
};

function scopesForCapability(capability: ProviderCapabilityType): string[] {
  return CAPABILITY_SCOPE_MAP[capability] ?? [];
}

export const connectionScopeResolver = {
  resolveRequestedScopes(providerKey: string, requestedScopes?: string[]): string[] {
    if (requestedScopes && requestedScopes.length > 0) {
      return requestedScopes;
    }
    const oauthDef = getOAuthProviderDefinition(providerKey);
    return oauthDef?.defaultScopes ?? [];
  },

  computeMissingScopes(requestedScopes: string[], grantedScopes: string[]): string[] {
    const granted = new Set(grantedScopes);
    return requestedScopes.filter((scope) => !granted.has(scope));
  },

  resolve(providerKey: string, grantedScopes: string[]): ScopeResolution {
    const oauthDef = getOAuthProviderDefinition(providerKey);
    const providerDef = getProviderDefinition(providerKey);
    const requestedScopes = oauthDef?.defaultScopes ?? [];
    const optionalScopes = oauthDef?.optionalScopes ?? [];
    const granted = new Set(grantedScopes);

    const missingScopes = requestedScopes.filter((scope) => !granted.has(scope));
    const supportedCapabilities: ProviderCapabilityType[] = [];
    const unsupportedCapabilities: ProviderCapabilityType[] = [];

    for (const capability of providerDef?.capabilities ?? []) {
      const required = scopesForCapability(capability);
      const supported =
        required.length === 0 || required.every((scope) => granted.has(scope));
      if (supported) {
        supportedCapabilities.push(capability);
      } else {
        unsupportedCapabilities.push(capability);
      }
    }

    return {
      requestedScopes,
      grantedScopes,
      missingScopes,
      optionalScopes,
      supportedCapabilities,
      unsupportedCapabilities,
    };
  },

  hasCapability(providerKey: string, grantedScopes: string[], capability: ProviderCapabilityType): boolean {
    const resolution = this.resolve(providerKey, grantedScopes);
    return resolution.supportedCapabilities.includes(capability);
  },

  async upsertScopeRecord(input: {
    organisationId: string;
    connectionId: string;
    requestedScopes: string[];
    grantedScopes: string[];
    optionalScopes?: string[];
  }) {
    const missingScopes = this.computeMissingScopes(input.requestedScopes, input.grantedScopes);
    const resolution = this.resolve(
      (
        await prisma.providerConnection.findUnique({
          where: { id: input.connectionId },
          select: { providerKey: true },
        })
      )?.providerKey ?? "",
      input.grantedScopes,
    );

    return prisma.providerConnectionScopeRecord.upsert({
      where: { connectionId: input.connectionId },
      create: {
        organisationId: input.organisationId,
        connectionId: input.connectionId,
        requestedScopes: input.requestedScopes,
        grantedScopes: input.grantedScopes,
        missingScopes,
        optionalScopes: input.optionalScopes ?? [],
        capabilityMap: {
          supported: resolution.supportedCapabilities,
          unsupported: resolution.unsupportedCapabilities,
        },
      },
      update: {
        requestedScopes: input.requestedScopes,
        grantedScopes: input.grantedScopes,
        missingScopes,
        optionalScopes: input.optionalScopes ?? [],
        capabilityMap: {
          supported: resolution.supportedCapabilities,
          unsupported: resolution.unsupportedCapabilities,
        },
      },
    });
  },

  async getScopeRecord(organisationId: string, connectionId: string) {
    return prisma.providerConnectionScopeRecord.findFirst({
      where: { organisationId, connectionId },
    });
  },
};
