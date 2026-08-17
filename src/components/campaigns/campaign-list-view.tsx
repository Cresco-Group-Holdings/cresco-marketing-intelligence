"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button, ButtonLink } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { CampaignEmptyState } from "@/components/campaigns/campaign-empty-state";
import { CampaignStatusBadge } from "@/components/campaigns/campaign-status-badge";
import { formatCampaignError, listCampaigns } from "@/components/campaigns/campaign-api";
import {
  CAMPAIGN_OBJECTIVE_LABELS,
  CAMPAIGN_STATUSES,
  CAMPAIGN_STATUS_LABELS,
  type CampaignObjective,
  type CampaignSummary,
} from "@/components/campaigns/types";

function formatDateRange(startAt?: string | null, endAt?: string | null): string {
  if (!startAt && !endAt) return "No schedule";
  if (startAt && endAt) {
    return `${new Date(startAt).toLocaleDateString()} – ${new Date(endAt).toLocaleDateString()}`;
  }
  if (startAt) return `From ${new Date(startAt).toLocaleDateString()}`;
  return `Until ${new Date(endAt!).toLocaleDateString()}`;
}

function objectiveLabel(objective?: string | null): string {
  if (!objective) return "—";
  return CAMPAIGN_OBJECTIVE_LABELS[objective as CampaignObjective] ?? objective.replace(/_/g, " ").toLowerCase();
}

export function CampaignListView() {
  const { preference } = useWorkspace();
  const organisationId = preference.currentOrganisationId;
  const brandId = preference.currentBrandId;

  const [campaigns, setCampaigns] = useState<CampaignSummary[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadCampaigns = useCallback(async () => {
    if (!organisationId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await listCampaigns(organisationId, {
        brandId,
        status: statusFilter || undefined,
        search: search.trim() || undefined,
      });
      setCampaigns(data.items);
    } catch (caught) {
      setError(formatCampaignError(caught));
    } finally {
      setLoading(false);
    }
  }, [organisationId, brandId, statusFilter, search]);

  useEffect(() => {
    void loadCampaigns();
  }, [loadCampaigns]);

  const filteredCampaigns = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return campaigns;
    return campaigns.filter(
      (campaign) =>
        campaign.name.toLowerCase().includes(query) ||
        (campaign.description?.toLowerCase().includes(query) ?? false),
    );
  }, [campaigns, search]);

  if (!organisationId) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-foreground-muted">
          Select an organisation workspace to manage campaigns.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Campaigns"
        description="Plan, coordinate, and track marketing campaigns across channels."
        breadcrumbs={[{ label: "Overview", href: "/dashboard" }, { label: "Campaigns" }]}
        actions={<ButtonLink href="/campaigns/new">New campaign</ButtonLink>}
      />

      {!brandId ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-foreground-muted">
            Select a brand in the workspace header to filter campaigns by brand context.
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardContent className="flex flex-wrap items-end gap-4 py-5">
          <Input
            label="Search"
            placeholder="Search campaigns"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="min-w-[220px] flex-1"
          />
          <div className="min-w-[180px] space-y-2">
            <label htmlFor="campaign-status-filter" className="block text-sm font-medium text-foreground-muted">
              Status
            </label>
            <select
              id="campaign-status-filter"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="block w-full rounded-lg border border-border-strong bg-surface-elevated px-3 py-2 text-sm text-foreground shadow-sm focus-visible:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">All statuses</option>
              {CAMPAIGN_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {CAMPAIGN_STATUS_LABELS[status]}
                </option>
              ))}
            </select>
          </div>
          <Button variant="outline" onClick={() => void loadCampaigns()}>
            Refresh
          </Button>
        </CardContent>
      </Card>

      {error ? <p className="text-sm text-danger">{error}</p> : null}
      {loading ? <p className="text-sm text-foreground-muted">Loading campaigns…</p> : null}

      {!loading && !error && filteredCampaigns.length === 0 ? (
        <CampaignEmptyState
          title="No campaigns yet"
          description="Create your first campaign to define objectives, channels, budget, audience, and KPIs in one workspace."
        />
      ) : null}

      {!loading && filteredCampaigns.length > 0 ? (
        <Card>
          <CardContent className="divide-y divide-border-subtle p-0">
            <div className="hidden grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto] gap-4 px-6 py-3 text-xs font-medium uppercase tracking-wide text-foreground-subtle md:grid">
              <span>Campaign</span>
              <span>Objective</span>
              <span>Schedule</span>
              <span>Status</span>
            </div>
            {filteredCampaigns.map((campaign) => (
              <Link
                key={campaign.id}
                href={`/campaigns/${campaign.id}`}
                className="flex flex-col gap-3 px-6 py-4 hover:bg-surface-subtle md:grid md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto] md:items-center"
              >
                <div>
                  <p className="font-medium text-foreground">{campaign.name}</p>
                  {campaign.description ? (
                    <p className="mt-1 line-clamp-1 text-xs text-foreground-subtle">{campaign.description}</p>
                  ) : null}
                  <p className="mt-1 text-xs text-foreground-subtle">
                    {(campaign.channelCount ?? 0).toLocaleString()} channels ·{" "}
                    {(campaign.kpiCount ?? 0).toLocaleString()} KPIs ·{" "}
                    {(campaign.memberCount ?? 0).toLocaleString()} members
                  </p>
                </div>
                <span className="text-sm text-foreground-muted">{objectiveLabel(campaign.primaryObjective)}</span>
                <span className="text-sm text-foreground-muted">{formatDateRange(campaign.startAt, campaign.endAt)}</span>
                <div className="flex justify-start md:justify-end">
                  <CampaignStatusBadge status={campaign.status} />
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
