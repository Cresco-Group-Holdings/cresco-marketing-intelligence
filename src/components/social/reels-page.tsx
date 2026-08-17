"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { MarketingDateRangeProvider } from "@/components/marketing/marketing-date-range-provider";
import { DashboardSkeleton } from "@/components/ui/skeleton";
import { ReelsWorkspace } from "@/components/social/reels-workspace";
import { apiFetch } from "@/lib/api/client";
import type { OrganicSocialWorkspaceData } from "@/lib/organic-social/types";

function ReelsPageContent() {
  const searchParams = useSearchParams();
  const [data, setData] = useState<OrganicSocialWorkspaceData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const query = searchParams.toString();
      const response = await apiFetch<{ workspace: OrganicSocialWorkspaceData }>(
        `/api/social/workspace${query ? `?${query}` : ""}`,
      );
      setData(response.workspace);
    } finally {
      setLoading(false);
    }
  }, [searchParams]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !data) return <DashboardSkeleton />;
  if (!data) return null;

  return <ReelsWorkspace reels={data.reels} />;
}

export function ReelsPage() {
  return (
    <MarketingDateRangeProvider>
      <ReelsPageContent />
    </MarketingDateRangeProvider>
  );
}
