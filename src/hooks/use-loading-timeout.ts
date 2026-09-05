"use client";

import { useCallback, useEffect, useState } from "react";

const DEFAULT_TIMEOUT_MS = 12_000;

export function useLoadingTimeout(
  loading: boolean,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): { timedOut: boolean; reset: () => void } {
  const [timedOut, setTimedOut] = useState(false);

  const reset = useCallback(() => {
    setTimedOut(false);
  }, []);

  useEffect(() => {
    if (!loading) {
      setTimedOut(false);
      return;
    }

    const timer = window.setTimeout(() => {
      setTimedOut(true);
    }, timeoutMs);

    return () => window.clearTimeout(timer);
  }, [loading, timeoutMs]);

  return {
    timedOut,
    reset,
  };
}
