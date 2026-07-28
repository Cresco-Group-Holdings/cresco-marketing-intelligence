import type { ConnectorType } from "@prisma/client";
import type {
  ConnectorAdapterContext,
  ConnectorSyncPage,
  ConnectorSyncResult,
  OAuthTokenPair,
} from "@/lib/connectors/types";

export type ConnectorAdapter = {
  readonly connectorType: ConnectorType;
  exchangeCode(input: {
    code: string;
    redirectUri: string;
    codeVerifier?: string;
  }): Promise<OAuthTokenPair>;
  refreshTokens(refreshToken: string): Promise<OAuthTokenPair>;
  revokeTokens(accessToken: string, refreshToken?: string): Promise<void>;
  fetchPage<T>(input: {
    context: ConnectorAdapterContext;
    accessToken: string;
    cursor?: string;
    pageSize?: number;
  }): Promise<ConnectorSyncPage<T>>;
  mapPageToSyncResult<T>(page: ConnectorSyncPage<T>): ConnectorSyncResult;
};

export type ConnectorAdapterFactory = {
  getAdapter(connectorType: ConnectorType): ConnectorAdapter | null;
};
