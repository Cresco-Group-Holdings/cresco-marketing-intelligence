"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { MarketingDateRangeProvider } from "@/components/marketing/marketing-date-range-provider";
import { DateRangeSelector } from "@/components/marketing/date-range-selector";
import { CampaignTable } from "@/components/advertising/campaign-table";
import { DashboardSkeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api/client";
import type { PaidAdvertisingWorkspaceData } from "@/lib/paid-advertising/types";

function CampaignsWorkspaceContent() {
  const searchParams = useSearchParams();
  const [data, setData] = useState<PaidAdvertisingWorkspaceData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const query = searchParams.toString();
      const response = await apiFetch<{ workspace: PaidAdvertisingWorkspaceData }>(
        `/api/advertising/workspace${query ? `?${query}` : ""}`,
      );
      setData(response.workspace);
    } finally {
      setLoading(false);
    }
  }, [searchParams]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !data) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Campaigns"
        description="Monitor campaign performance, status and optimisation signals."
        actions={<DateRangeSelector />}
      />
      {data ? (
        <CampaignTable campaigns={data.campaigns} currency={data.currency} />
      ) : (
        <p className="text-sm text-foreground-muted">Unable to load campaigns.</p>
      )}
    </div>
  );
}

export function CampaignsWorkspace() {
  return (
    <MarketingDateRangeProvider>
      <CampaignsWorkspaceContent />
    </MarketingDateRangeProvider>
  );
}
