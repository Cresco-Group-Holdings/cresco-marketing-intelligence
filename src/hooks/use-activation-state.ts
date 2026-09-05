"use client";

import { useCallback, useMemo } from "react";
import { apiFetch } from "@/lib/api/client";
import { useApiResource } from "@/hooks/use-api-resource";
import type { ActivationState } from "@/server/services/activation-service";

export function useActivationState(options?: { enabled?: boolean }) {
  const loader = useCallback(
    () => apiFetch<{ activation: ActivationState }>("/api/activation"),
    [],
  );

  const resource = useApiResource("activation-state", loader, {
    enabled: options?.enabled ?? true,
  });

  return useMemo(
    () => ({
      activation: resource.data?.activation ?? null,
      loading: resource.loading,
      error: resource.error,
      errorCode: resource.errorCode,
      requestCount: resource.requestCount,
      refresh: resource.refresh,
    }),
    [
      resource.data,
      resource.loading,
      resource.error,
      resource.errorCode,
      resource.requestCount,
      resource.refresh,
    ],
  );
}
