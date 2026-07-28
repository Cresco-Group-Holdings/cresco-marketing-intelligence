import type { ConnectorSyncStatus, ConnectorSyncType } from "@prisma/client";
import type { ConnectorAdapter } from "@/lib/connectors/adapters/types";
import type { ConnectorSyncResult } from "@/lib/connectors/types";
import { isRateLimitError, withRetry } from "@/lib/connectors/sync/retry";

export type SyncEngineInput = {
  syncId: string;
  syncType: ConnectorSyncType;
  adapter: ConnectorAdapter;
  accessToken: string;
  initialCursor?: string;
  pageSize?: number;
  shouldCancel?: () => boolean;
  onPage: (result: ConnectorSyncResult, cursor?: string) => Promise<void>;
  context: Parameters<ConnectorAdapter["fetchPage"]>[0]["context"];
};

export type SyncEngineOutput = {
  status: ConnectorSyncStatus;
  recordsProcessed: number;
  recordsFailed: number;
  partialFailure: boolean;
  finalCursor?: string;
  errorMessage?: string;
};

export async function runConnectorSync(input: SyncEngineInput): Promise<SyncEngineOutput> {
  let cursor = input.initialCursor;
  let recordsProcessed = 0;
  let recordsFailed = 0;
  let partialFailure = false;

  try {
    while (true) {
      if (input.shouldCancel?.()) {
        return {
          status: "CANCELLED",
          recordsProcessed,
          recordsFailed,
          partialFailure,
          finalCursor: cursor,
          errorMessage: "Sync cancelled.",
        };
      }

      const page = await withRetry(
        () =>
          input.adapter.fetchPage({
            context: input.context,
            accessToken: input.accessToken,
            cursor,
            pageSize: input.pageSize,
          }),
        { isRetryable: isRateLimitError },
      );

      const result = input.adapter.mapPageToSyncResult(page);
      recordsProcessed += result.recordsProcessed;
      recordsFailed += result.recordsFailed;
      partialFailure = partialFailure || result.partialFailure;
      cursor = result.nextCursor;

      await input.onPage(result, cursor);

      if (!cursor) {
        break;
      }
    }

    if (partialFailure || recordsFailed > 0) {
      return {
        status: "PARTIAL",
        recordsProcessed,
        recordsFailed,
        partialFailure: true,
        finalCursor: cursor,
      };
    }

    return {
      status: "COMPLETED",
      recordsProcessed,
      recordsFailed,
      partialFailure: false,
      finalCursor: cursor,
    };
  } catch (error) {
    return {
      status: "FAILED",
      recordsProcessed,
      recordsFailed: recordsFailed + 1,
      partialFailure: true,
      finalCursor: cursor,
      errorMessage: error instanceof Error ? error.message : "Sync failed.",
    };
  }
}
