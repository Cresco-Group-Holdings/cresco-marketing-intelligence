import type { ConnectorType } from "@prisma/client";
import type { ConnectorAdapter, ConnectorAdapterFactory } from "@/lib/connectors/adapters/types";
import type {
  ConnectorAdapterContext,
  ConnectorSyncPage,
  ConnectorSyncResult,
  OAuthTokenPair,
} from "@/lib/connectors/types";

export class FakeConnectorAdapter implements ConnectorAdapter {
  readonly connectorType: ConnectorType;

  constructor(connectorType: ConnectorType) {
    this.connectorType = connectorType;
  }

  async exchangeCode(): Promise<OAuthTokenPair> {
    return {
      accessToken: "fake-access-token",
      refreshToken: "fake-refresh-token",
      expiresAt: new Date(Date.now() + 3_600_000),
      scopes: ["read_only"],
    };
  }

  async refreshTokens(refreshToken: string): Promise<OAuthTokenPair> {
    if (!refreshToken) {
      throw new Error("Refresh token is required.");
    }
    return {
      accessToken: "fake-refreshed-access-token",
      refreshToken,
      expiresAt: new Date(Date.now() + 3_600_000),
      scopes: ["read_only"],
    };
  }

  async revokeTokens(): Promise<void> {
    return;
  }

  async fetchPage<T>(input: {
    context: ConnectorAdapterContext;
    accessToken: string;
    cursor?: string;
    pageSize?: number;
  }): Promise<ConnectorSyncPage<T>> {
    if (!input.accessToken) {
      throw new Error("Access token is required.");
    }

    const pageSize = input.pageSize ?? 2;
    const start = input.cursor ? Number(input.cursor) : 0;
    const items = Array.from({ length: pageSize }, (_, index) => ({
      id: `${input.context.connectorAccountId}-${start + index}`,
      label: `record-${start + index}`,
    })) as T[];

    const nextStart = start + pageSize;
    return {
      items,
      nextCursor: nextStart >= 4 ? undefined : String(nextStart),
    };
  }

  mapPageToSyncResult<T>(page: ConnectorSyncPage<T>): ConnectorSyncResult {
    return {
      recordsProcessed: page.items.length,
      recordsFailed: 0,
      partialFailure: false,
      nextCursor: page.nextCursor,
    };
  }
}

export class InMemoryConnectorAdapterFactory implements ConnectorAdapterFactory {
  private readonly adapters = new Map<ConnectorType, ConnectorAdapter>();

  register(adapter: ConnectorAdapter): void {
    this.adapters.set(adapter.connectorType, adapter);
  }

  getAdapter(connectorType: ConnectorType): ConnectorAdapter | null {
    return this.adapters.get(connectorType) ?? null;
  }

  reset(): void {
    this.adapters.clear();
  }
}

export const connectorAdapterFactory = new InMemoryConnectorAdapterFactory();

export function registerFakeConnectorAdapter(connectorType: ConnectorType): FakeConnectorAdapter {
  const adapter = new FakeConnectorAdapter(connectorType);
  connectorAdapterFactory.register(adapter);
  return adapter;
}

export function resetConnectorAdaptersForTests(): void {
  connectorAdapterFactory.reset();
}
