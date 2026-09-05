"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiClientError } from "@/lib/api/client";
import { DEFAULT_API_FETCH_RETRY_POLICY } from "@/lib/api/fetch-policy";

export type ApiResourceState<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
  errorCode: string | null;
  requestCount: number;
  refresh: () => Promise<void>;
};

type UseApiResourceOptions<T> = {
  enabled?: boolean;
  initialData?: T | null;
};

export function useApiResource<T>(
  key: string,
  loader: () => Promise<T>,
  options?: UseApiResourceOptions<T>,
): ApiResourceState<T> {
  const enabled = options?.enabled ?? true;
  const [data, setData] = useState<T | null>(options?.initialData ?? null);
  const [loading, setLoading] = useState(enabled && options?.initialData == null);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [requestCount, setRequestCount] = useState(0);
  const requestGenerationRef = useRef(0);

  const refresh = useCallback(async () => {
    if (!enabled) {
      return;
    }

    const generation = requestGenerationRef.current + 1;
    requestGenerationRef.current = generation;
    setLoading(true);
    setError(null);
    setErrorCode(null);

    try {
      const result = await loader();
      if (requestGenerationRef.current !== generation) {
        return;
      }
      setData(result);
      setRequestCount((count) => count + 1);
    } catch (err) {
      if (requestGenerationRef.current !== generation) {
        return;
      }
      setError(err instanceof Error ? err.message : "Request failed.");
      setErrorCode(err instanceof ApiClientError ? err.code : null);
      setRequestCount((count) => count + 1);
    } finally {
      if (requestGenerationRef.current === generation) {
        setLoading(false);
      }
    }
  }, [enabled, loader]);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    void refresh();
  }, [enabled, key, refresh]);

  return {
    data,
    loading,
    error,
    errorCode,
    requestCount,
    refresh,
  };
}

export function getMaxClientAttempts(): number {
  return DEFAULT_API_FETCH_RETRY_POLICY.maxAttempts;
}
