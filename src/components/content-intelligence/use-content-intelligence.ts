"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api/client";
import type { ContentIntelligenceWorkspace } from "@/lib/content-intelligence/types";
import { useContentIntelligencePreviewData } from "@/components/content-intelligence/content-intelligence-preview-context";
import { useLoadingTimeout } from "@/hooks/use-loading-timeout";

export function useContentIntelligence() {
  const previewData = useContentIntelligencePreviewData();
  const [data, setData] = useState<ContentIntelligenceWorkspace | null>(previewData ?? null);
  const [loading, setLoading] = useState(!previewData);
  const [error, setError] = useState<string | null>(null);
  const timedOut = useLoadingTimeout(loading, 15000);

  const reload = useCallback(async () => {
    if (previewData) {
      setData(previewData);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await apiFetch<{ workspace: ContentIntelligenceWorkspace }>(
        "/api/content-intelligence/workspace",
      );
      setData(response.workspace);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load content intelligence.");
    } finally {
      setLoading(false);
    }
  }, [previewData]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, loading, error, timedOut, reload };
}
