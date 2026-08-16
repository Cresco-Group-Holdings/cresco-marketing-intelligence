"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import type { PaidCampaignPerformance } from "@/lib/paid-advertising/types";

function formatCurrency(value: number | null, currency: string): string {
  if (value == null) return "—";
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

const STATE_VARIANT: Record<
  PaidCampaignPerformance["performanceState"],
  "success" | "warning" | "danger" | "muted"
> = {
  Strong: "success",
  Healthy: "success",
  "Needs attention": "warning",
  Underperforming: "danger",
  "Insufficient data": "muted",
};

const STATUS_OPTIONS = ["All", "Active", "Paused", "Draft", "Completed"] as const;

export function CampaignTable({
  campaigns,
  currency,
}: {
  campaigns: PaidCampaignPerformance[];
  currency: string;
}) {
  const [search, setSearch] = useState("");
  const [provider, setProvider] = useState("All");
  const [status, setStatus] = useState<(typeof STATUS_OPTIONS)[number]>("All");
  const [page, setPage] = useState(0);
  const pageSize = 20;

  const providers = useMemo(
    () => ["All", ...new Set(campaigns.map((campaign) => campaign.provider))],
    [campaigns],
  );

  const filtered = useMemo(() => {
    return campaigns.filter((campaign) => {
      const matchesSearch =
        search.trim().length === 0 ||
        campaign.name.toLowerCase().includes(search.toLowerCase());
      const matchesProvider = provider === "All" || campaign.provider === provider;
      const matchesStatus = status === "All" || campaign.status === status;
      return matchesSearch && matchesProvider && matchesStatus;
    });
  }, [campaigns, provider, search, status]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageItems = filtered.slice(page * pageSize, (page + 1) * pageSize);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input
          label="Search campaigns"
          type="search"
          placeholder="Search campaigns…"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(0);
          }}
          className="sm:max-w-xs"
        />
        <select
          value={provider}
          onChange={(event) => {
            setProvider(event.target.value);
            setPage(0);
          }}
          className="h-9 rounded-lg border border-border bg-surface px-3 text-sm text-foreground"
          aria-label="Filter by provider"
        >
          {providers.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <select
          value={status}
          onChange={(event) => {
            setStatus(event.target.value as (typeof STATUS_OPTIONS)[number]);
            setPage(0);
          }}
          className="h-9 rounded-lg border border-border bg-surface px-3 text-sm text-foreground"
          aria-label="Filter by status"
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-border bg-surface-subtle text-xs uppercase tracking-wide text-foreground-subtle">
            <tr>
              <th className="px-4 py-3 font-medium">Campaign</th>
              <th className="px-4 py-3 font-medium">Provider</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Spend</th>
              <th className="px-4 py-3 font-medium">ROAS</th>
              <th className="px-4 py-3 font-medium">Conversions</th>
              <th className="px-4 py-3 font-medium">CPA</th>
              <th className="px-4 py-3 font-medium">Performance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {pageItems.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-foreground-muted">
                  No campaigns match the current filters.
                </td>
              </tr>
            ) : (
              pageItems.map((campaign) => (
                <tr key={campaign.id} className="bg-surface-elevated hover:bg-surface-hover">
                  <td className="px-4 py-3 font-medium text-foreground">{campaign.name}</td>
                  <td className="px-4 py-3 text-foreground-muted">{campaign.provider}</td>
                  <td className="px-4 py-3">
                    <Badge variant="muted">{campaign.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-foreground-muted">
                    {formatCurrency(campaign.spend, currency)}
                  </td>
                  <td className="px-4 py-3 text-foreground-muted">
                    {campaign.roas != null ? `${campaign.roas.toFixed(2)}x` : "—"}
                  </td>
                  <td className="px-4 py-3 text-foreground-muted">
                    {campaign.conversions != null ? campaign.conversions.toLocaleString() : "—"}
                  </td>
                  <td className="px-4 py-3 text-foreground-muted">
                    {formatCurrency(campaign.cpa, currency)}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={STATE_VARIANT[campaign.performanceState]}>
                      {campaign.performanceState}
                    </Badge>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {filtered.length > pageSize ? (
        <div className="flex items-center justify-between text-sm text-foreground-muted">
          <span>
            Showing {page * pageSize + 1}–{Math.min((page + 1) * pageSize, filtered.length)} of{" "}
            {filtered.length}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              className="rounded-lg border border-border px-3 py-1.5 hover:bg-surface-hover disabled:opacity-50"
              disabled={page === 0}
              onClick={() => setPage((value) => value - 1)}
            >
              Previous
            </button>
            <button
              type="button"
              className="rounded-lg border border-border px-3 py-1.5 hover:bg-surface-hover disabled:opacity-50"
              disabled={page >= pageCount - 1}
              onClick={() => setPage((value) => value + 1)}
            >
              Next
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
