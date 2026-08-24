"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/api/client";
import type { OrganicGrowthEngineData } from "@/lib/organic-growth/types";
import { useOrganicGrowthPreviewData } from "@/components/organic-growth/organic-growth-preview-context";
import { useLoadingTimeout } from "@/hooks/use-loading-timeout";

export function useOrganicGrowthEngine() {
  const searchParams = useSearchParams();
  const previewData = useOrganicGrowthPreviewData();
  const [data, setData] = useState<OrganicGrowthEngineData | null>(previewData ?? null);
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
      const query = searchParams.toString();
      const response = await apiFetch<{ engine: OrganicGrowthEngineData }>(
        `/api/organic-growth/workspace${query ? `?${query}` : ""}`,
      );
      setData(response.engine);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load organic growth data.");
    } finally {
      setLoading(false);
    }
  }, [previewData, searchParams]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, loading, error, timedOut, reload };
}
