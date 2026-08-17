"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  CALENDAR_CHANNELS,
  CALENDAR_CHANNEL_LABELS,
  CALENDAR_EVENT_TYPES,
  CALENDAR_EVENT_TYPE_LABELS,
  type CalendarFilters,
} from "@/components/calendar/types";
import { listCampaigns } from "@/components/campaigns/campaign-api";
import type { CampaignSummary } from "@/components/campaigns/types";

type CalendarFiltersProps = {
  organisationId: string;
  projects: Array<{ id: string; name: string }>;
  brands: Array<{ id: string; name: string; projectId: string }>;
  filters: CalendarFilters;
  onChange: (filters: CalendarFilters) => void;
};

export function CalendarFiltersBar({
  organisationId,
  projects,
  brands,
  filters,
  onChange,
}: CalendarFiltersProps) {
  const [campaigns, setCampaigns] = useState<CampaignSummary[]>([]);
  const [loadingCampaigns, setLoadingCampaigns] = useState(false);

  const filteredBrands = filters.projectId
    ? brands.filter((brand) => brand.projectId === filters.projectId)
    : brands;

  useEffect(() => {
    if (!organisationId) return;
    setLoadingCampaigns(true);
    void listCampaigns(organisationId, { brandId: filters.brandId ?? undefined })
      .then((data) => setCampaigns(data.items))
      .catch(() => setCampaigns([]))
      .finally(() => setLoadingCampaigns(false));
  }, [organisationId, filters.brandId]);

  function updateFilter<K extends keyof CalendarFilters>(key: K, value: CalendarFilters[K]) {
    const next = { ...filters, [key]: value || null };
    if (key === "projectId") {
      next.brandId = null;
      next.campaignId = null;
    }
    if (key === "brandId") {
      next.campaignId = null;
    }
    onChange(next);
  }

  const selectClassName =
    "block w-full rounded-lg border border-border-strong bg-surface-elevated px-3 py-2 text-sm text-foreground shadow-sm focus-visible:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <Card>
      <CardContent className="grid gap-4 py-5 md:grid-cols-2 xl:grid-cols-5">
        <div className="space-y-2">
          <label htmlFor="calendar-project-filter" className="block text-sm font-medium text-foreground-muted">
            Project
          </label>
          <select
            id="calendar-project-filter"
            className={selectClassName}
            value={filters.projectId ?? ""}
            onChange={(event) => updateFilter("projectId", event.target.value || null)}
          >
            <option value="">All projects</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label htmlFor="calendar-brand-filter" className="block text-sm font-medium text-foreground-muted">
            Brand
          </label>
          <select
            id="calendar-brand-filter"
            className={selectClassName}
            value={filters.brandId ?? ""}
            onChange={(event) => updateFilter("brandId", event.target.value || null)}
          >
            <option value="">All brands</option>
            {filteredBrands.map((brand) => (
              <option key={brand.id} value={brand.id}>
                {brand.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label htmlFor="calendar-campaign-filter" className="block text-sm font-medium text-foreground-muted">
            Campaign
          </label>
          <select
            id="calendar-campaign-filter"
            className={selectClassName}
            value={filters.campaignId ?? ""}
            disabled={loadingCampaigns}
            onChange={(event) => updateFilter("campaignId", event.target.value || null)}
          >
            <option value="">{loadingCampaigns ? "Loading campaigns…" : "All campaigns"}</option>
            {campaigns.map((campaign) => (
              <option key={campaign.id} value={campaign.id}>
                {campaign.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label htmlFor="calendar-channel-filter" className="block text-sm font-medium text-foreground-muted">
            Channel
          </label>
          <select
            id="calendar-channel-filter"
            className={selectClassName}
            value={filters.channel ?? ""}
            onChange={(event) => updateFilter("channel", event.target.value || null)}
          >
            <option value="">All channels</option>
            {CALENDAR_CHANNELS.map((channel) => (
              <option key={channel} value={channel}>
                {CALENDAR_CHANNEL_LABELS[channel]}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label htmlFor="calendar-type-filter" className="block text-sm font-medium text-foreground-muted">
            Event type
          </label>
          <select
            id="calendar-type-filter"
            className={selectClassName}
            value={filters.eventType ?? ""}
            onChange={(event) => updateFilter("eventType", event.target.value || null)}
          >
            <option value="">All types</option>
            {CALENDAR_EVENT_TYPES.map((eventType) => (
              <option key={eventType} value={eventType}>
                {CALENDAR_EVENT_TYPE_LABELS[eventType]}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-end md:col-span-2 xl:col-span-5">
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              onChange({
                projectId: null,
                brandId: null,
                campaignId: null,
                channel: null,
                eventType: null,
              })
            }
          >
            Clear filters
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
