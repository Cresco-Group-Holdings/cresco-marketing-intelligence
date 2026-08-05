import type { ProviderSyncRunStatus } from "@prisma/client";
import type { SyncPageResult } from "@/lib/integrations/sync/types";
import { isRateLimitError, withRetry } from "@/lib/connectors/sync/retry";

export type ProviderSyncEngineInput = {
  resourceType: string;
  initialCursor?: string;
  pageSize?: number;
  fetchPage: (cursor?: string) => Promise<SyncPageResult>;
  onPage: (result: SyncPageResult, cursor?: string) => Promise<void>;
  onFailure?: (input: {
    resourceType: string;
    cursor?: string;
    externalResourceId?: string;
    error: Error;
  }) => Promise<void>;
  shouldCancel?: () => boolean;
};

export type ProviderSyncEngineOutput = {
  status: ProviderSyncRunStatus;
  recordsProcessed: number;
  recordsFailed: number;
  partialFailure: boolean;
  finalCursor?: string;
  errorMessage?: string;
  warnings: string[];
};

export async function runProviderSyncEngine(
  input: ProviderSyncEngineInput,
): Promise<ProviderSyncEngineOutput> {
  let cursor = input.initialCursor;
  let recordsProcessed = 0;
  let recordsFailed = 0;
  let partialFailure = false;
  const warnings: string[] = [];

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
          warnings,
        };
      }

      let page: SyncPageResult;
      try {
        page = await withRetry(() => input.fetchPage(cursor), {
          isRetryable: isRateLimitError,
        });
      } catch (error) {
        recordsFailed += 1;
        partialFailure = true;
        await input.onFailure?.({
          resourceType: input.resourceType,
          cursor,
          error: error instanceof Error ? error : new Error("Page fetch failed."),
        });
        break;
      }

      recordsProcessed += page.records.length;
      if (page.partialFailure) partialFailure = true;
      if (page.warnings?.length) warnings.push(...page.warnings);
      cursor = page.nextCursor;

      await input.onPage(page, cursor);

      if (!cursor) break;
    }

    if (partialFailure || recordsFailed > 0) {
      return {
        status: "PARTIAL",
        recordsProcessed,
        recordsFailed,
        partialFailure: true,
        finalCursor: cursor,
        warnings,
      };
    }

    return {
      status: "COMPLETED",
      recordsProcessed,
      recordsFailed,
      partialFailure: false,
      finalCursor: cursor,
      warnings,
    };
  } catch (error) {
    return {
      status: "FAILED",
      recordsProcessed,
      recordsFailed: recordsFailed + 1,
      partialFailure: true,
      finalCursor: cursor,
      errorMessage: error instanceof Error ? error.message : "Sync failed.",
      warnings,
    };
  }
}
