"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button, ButtonLink } from "@/components/ui/button";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { CampaignActivityFeed } from "@/components/campaigns/campaign-activity-feed";
import { CampaignChannelsPanel } from "@/components/campaigns/campaign-channels-panel";
import { CampaignKpiPanel } from "@/components/campaigns/campaign-kpi-panel";
import { CampaignModulePlaceholder } from "@/components/campaigns/campaign-module-placeholder";
import { CampaignStatusBadge } from "@/components/campaigns/campaign-status-badge";
import { CampaignTeamPanel } from "@/components/campaigns/campaign-team-panel";
import {
  formatCampaignError,
  getCampaign,
  isCampaignVersionConflict,
  updateCampaign,
} from "@/components/campaigns/campaign-api";
import {
  CAMPAIGN_OBJECTIVE_LABELS,
  type CampaignDetail,
  type CampaignDetailTab,
  type CampaignObjective,
} from "@/components/campaigns/types";

const TABS: Array<{ id: CampaignDetailTab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "strategy", label: "Strategy" },
  { id: "channels", label: "Channels" },
  { id: "budget", label: "Budget" },
  { id: "audience", label: "Audience" },
  { id: "kpis", label: "KPIs" },
  { id: "content", label: "Content" },
  { id: "assets", label: "Assets" },
  { id: "tasks", label: "Tasks" },
  { id: "team", label: "Team" },
  { id: "activity", label: "Activity" },
];

function formatDateRange(startAt?: string | null, endAt?: string | null): string {
  if (!startAt && !endAt) return "No schedule set";
  if (startAt && endAt) {
    return `${new Date(startAt).toLocaleDateString()} – ${new Date(endAt).toLocaleDateString()}`;
  }
  if (startAt) return `From ${new Date(startAt).toLocaleDateString()}`;
  return `Until ${new Date(endAt!).toLocaleDateString()}`;
}

function objectiveLabel(objective?: string | null): string {
  if (!objective) return "Not set";
  return CAMPAIGN_OBJECTIVE_LABELS[objective as CampaignObjective] ?? objective.replace(/_/g, " ").toLowerCase();
}

export function CampaignDetailView({ campaignId }: { campaignId: string }) {
  const { preference } = useWorkspace();
  const organisationId = preference.currentOrganisationId;

  const [campaign, setCampaign] = useState<CampaignDetail | null>(null);
  const [activeTab, setActiveTab] = useState<CampaignDetailTab>("overview");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [versionConflict, setVersionConflict] = useState(false);
  const [strategyDraft, setStrategyDraft] = useState("");

  const loadCampaign = useCallback(async () => {
    if (!organisationId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    setVersionConflict(false);
    try {
      const data = await getCampaign(campaignId, organisationId);
      setCampaign(data);
      setStrategyDraft(data.strategy?.narrative ?? "");
    } catch (caught) {
      setError(formatCampaignError(caught));
      setVersionConflict(isCampaignVersionConflict(caught));
    } finally {
      setLoading(false);
    }
  }, [campaignId, organisationId]);

  useEffect(() => {
    void loadCampaign();
  }, [loadCampaign]);

  async function saveStrategy() {
    if (!organisationId || !campaign) return;

    setSaving(true);
    setError(null);
    setVersionConflict(false);
    try {
      const updated = await updateCampaign(campaignId, organisationId, {
        brandId: campaign.brandId,
        name: campaign.name,
        version: campaign.version,
        strategy: {
          narrative: strategyDraft.trim() || undefined,
        },
      });
      setCampaign(updated);
      setStrategyDraft(updated.strategy?.narrative ?? "");
    } catch (caught) {
      setError(formatCampaignError(caught));
      setVersionConflict(isCampaignVersionConflict(caught));
    } finally {
      setSaving(false);
    }
  }

  if (!organisationId) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-slate-600">
          Select an organisation workspace to view campaign details.
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return <p className="text-sm text-slate-600">Loading campaign…</p>;
  }

  if (error && !campaign) {
    return (
      <Card>
        <CardContent className="space-y-3 py-8 text-center">
          <p className="text-sm text-red-600">{error}</p>
          {versionConflict ? (
            <p className="text-sm text-slate-600">
              Another update changed this campaign. Reload to continue with the latest version.
            </p>
          ) : null}
          <div className="flex justify-center gap-2">
            <Button variant="outline" onClick={() => void loadCampaign()}>
              Retry
            </Button>
            <ButtonLink href="/campaigns" variant="outline">
              Back to campaigns
            </ButtonLink>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!campaign) return null;

  return (
    <div className="space-y-6">
      <PageHeader
        title={campaign.name}
        description={campaign.description ?? "Campaign workspace"}
        breadcrumbs={[
          { label: "Campaigns", href: "/campaigns" },
          { label: campaign.name },
        ]}
        actions={
          <div className="flex flex-wrap gap-2">
            <CampaignStatusBadge status={campaign.status} />
            <ButtonLink href="/campaigns" variant="outline">
              All campaigns
            </ButtonLink>
          </div>
        }
      />

      {error ? (
        <Card>
          <CardContent className="space-y-2 py-4">
            <p className="text-sm text-red-600">{error}</p>
            {versionConflict ? (
              <div className="flex flex-wrap gap-2">
                <p className="text-sm text-slate-600">
                  This campaign was updated elsewhere. Reload to get the latest version before saving again.
                </p>
                <Button size="sm" variant="outline" onClick={() => void loadCampaign()}>
                  Reload campaign
                </Button>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <nav className="flex flex-wrap gap-2 border-b border-slate-200 pb-3" aria-label="Campaign sections">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? "bg-slate-900 text-white"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {activeTab === "overview" ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-700">
              <p>
                <span className="font-medium text-slate-900">Objective:</span>{" "}
                {objectiveLabel(campaign.primaryObjective)}
              </p>
              <p>
                <span className="font-medium text-slate-900">Schedule:</span>{" "}
                {formatDateRange(campaign.startAt, campaign.endAt)}
              </p>
              <p>
                <span className="font-medium text-slate-900">Budget:</span>{" "}
                {campaign.budgetAmount != null
                  ? `${campaign.budgetCurrency ?? "USD"} ${campaign.budgetAmount.toLocaleString()}`
                  : "Not set"}
              </p>
              <p>
                <span className="font-medium text-slate-900">Version:</span> v{campaign.version}
              </p>
              <p>
                <span className="font-medium text-slate-900">Updated:</span>{" "}
                {new Date(campaign.updatedAt).toLocaleString()}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Counts</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-slate-700">
              <p>{(campaign.channels?.length ?? campaign.channelCount ?? 0).toLocaleString()} channels</p>
              <p>{(campaign.kpis?.length ?? campaign.kpiCount ?? 0).toLocaleString()} KPIs</p>
              <p>{(campaign.members?.length ?? campaign.memberCount ?? 0).toLocaleString()} team members</p>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {activeTab === "strategy" ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Strategy</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="strategy-narrative" className="block text-sm font-medium text-slate-700">
                Strategy narrative
              </label>
              <textarea
                id="strategy-narrative"
                value={strategyDraft}
                onChange={(event) => setStrategyDraft(event.target.value)}
                rows={6}
                className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus-visible:border-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-200"
                placeholder="Describe the campaign strategy, messaging pillars, and key bets."
              />
            </div>
            {campaign.strategy?.targetOutcomes?.length ? (
              <div>
                <p className="text-sm font-medium text-slate-900">Target outcomes</p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
                  {campaign.strategy.targetOutcomes.map((outcome) => (
                    <li key={outcome}>{outcome}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            <Button disabled={saving} onClick={() => void saveStrategy()}>
              Save strategy
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {activeTab === "channels" ? (
        <CampaignChannelsPanel channels={campaign.channels ?? []} />
      ) : null}

      {activeTab === "budget" ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Budget</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-700">
            <p>
              <span className="font-medium text-slate-900">Total budget:</span>{" "}
              {campaign.budgetAmount != null
                ? `${campaign.budgetCurrency ?? "USD"} ${campaign.budgetAmount.toLocaleString()}`
                : "Not set"}
            </p>
            {(campaign.channels ?? []).some((channel) => channel.budgetAmount != null) ? (
              <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                {(campaign.channels ?? [])
                  .filter((channel) => channel.budgetAmount != null)
                  .map((channel) => (
                    <div key={channel.id} className="flex items-center justify-between px-4 py-3">
                      <span>{channel.channelType.replace(/_/g, " ").toLowerCase()}</span>
                      <span>{channel.budgetAmount?.toLocaleString()}</span>
                    </div>
                  ))}
              </div>
            ) : (
              <p className="text-slate-600">No channel-level budget allocations yet.</p>
            )}
          </CardContent>
        </Card>
      ) : null}

      {activeTab === "audience" ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Audience</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-700">
            <p>{campaign.audience?.description ?? "No audience description provided."}</p>
            {campaign.audience?.segments?.length ? (
              <ul className="list-disc space-y-1 pl-5">
                {campaign.audience.segments.map((segment) => (
                  <li key={segment}>{segment}</li>
                ))}
              </ul>
            ) : (
              <p className="text-slate-600">No audience segments defined.</p>
            )}
          </CardContent>
        </Card>
      ) : null}

      {activeTab === "kpis" ? <CampaignKpiPanel kpis={campaign.kpis ?? []} /> : null}

      {activeTab === "content" ? (
        <CampaignModulePlaceholder
          title="Content"
          description="Campaign content planning will connect here in a later stage. Linked content items and production workflows are not yet available."
        />
      ) : null}

      {activeTab === "assets" ? (
        <CampaignModulePlaceholder
          title="Assets"
          description="Campaign asset libraries and creative bundles will connect here in a later stage."
        />
      ) : null}

      {activeTab === "tasks" ? (
        <CampaignModulePlaceholder
          title="Tasks"
          description="Campaign task management will connect here in a later stage. Use the Tasks module for operational work in the meantime."
        />
      ) : null}

      {activeTab === "team" ? <CampaignTeamPanel members={campaign.members ?? []} /> : null}

      {activeTab === "activity" ? (
        <CampaignActivityFeed activities={campaign.activities ?? []} />
      ) : null}
    </div>
  );
}
