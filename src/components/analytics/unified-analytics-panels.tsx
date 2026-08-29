"use client";

import { Info } from "lucide-react";
import { MarketingMetricCard } from "@/components/marketing/marketing-metric-card";
import type { UnifiedKpi } from "@/lib/unified-analytics/types";

function KpiMetadata({ kpi }: { kpi: UnifiedKpi }) {
  const parts: string[] = [];
  if (kpi.metadata.kind) parts.push(kpi.metadata.kind);
  if (kpi.metadata.attributionModel) parts.push(`Model: ${kpi.metadata.attributionModel}`);
  if (kpi.metadata.coverage != null) parts.push(`Coverage: ${kpi.metadata.coverage.toFixed(0)}%`);
  if (kpi.footnote) parts.push(kpi.footnote);

  if (parts.length === 0) return null;

  return (
    <p className="mt-2 text-[11px] leading-relaxed text-foreground-subtle" title={kpi.metadata.limitations?.join(" ")}>
      {parts.join(" · ")}
    </p>
  );
}

export function UnifiedKpiStrip({ kpis }: { kpis: UnifiedKpi[] }) {
  return (
    <section
      aria-label="Unified analytics KPIs"
      className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4"
    >
      {kpis.map((kpi) => (
        <div key={kpi.label}>
          <MarketingMetricCard
            metric={{
              label: kpi.label,
              value: kpi.value,
              change: kpi.change,
              comparisonLabel: kpi.comparisonLabel,
            }}
          />
          <KpiMetadata kpi={kpi} />
        </div>
      ))}
    </section>
  );
}

export function CoveragePanel({
  coverage,
  warnings,
}: {
  coverage: import("@/lib/unified-analytics/types").CoverageDimension[];
  warnings: string[];
}) {
  return (
    <section className="rounded-xl border border-border bg-surface-elevated p-4 sm:p-5">
      <div className="flex items-center gap-2">
        <Info className="h-4 w-4 text-foreground-subtle" aria-hidden="true" />
        <h2 className="text-sm font-semibold text-foreground">Data coverage & measurement quality</h2>
      </div>
      <ul className="mt-4 space-y-2">
        {coverage.map((item) => (
          <li
            key={item.dimension}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm"
          >
            <span className="font-medium text-foreground">{item.dimension}</span>
            <span className="text-foreground-muted">
              {item.state}
              {item.coveragePercent != null ? ` · ${item.coveragePercent.toFixed(0)}%` : ""}
            </span>
          </li>
        ))}
      </ul>
      {warnings.length > 0 ? (
        <ul className="mt-4 space-y-1 text-xs text-warning">
          {warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

export function ChannelsPanel({
  channels,
  modelLabel,
}: {
  channels: import("@/lib/unified-analytics/types").ChannelAnalyticsRow[];
  modelLabel: string;
}) {
  if (channels.length === 0) {
    return (
      <p className="text-sm text-foreground-muted">No channel data available for the selected period.</p>
    );
  }

  return (
    <section className="overflow-x-auto rounded-xl border border-border bg-surface-elevated">
      <table className="min-w-full text-sm">
        <thead className="border-b border-border bg-surface text-left text-xs uppercase tracking-wide text-foreground-subtle">
          <tr>
            <th className="px-4 py-3">Channel</th>
            <th className="px-4 py-3">Type</th>
            <th className="px-4 py-3">Spend</th>
            <th className="px-4 py-3">Impressions</th>
            <th className="px-4 py-3">Clicks</th>
            <th className="px-4 py-3">Conversions</th>
            <th className="px-4 py-3">Attributed revenue</th>
            <th className="px-4 py-3">Contribution %</th>
          </tr>
        </thead>
        <tbody>
          {channels.map((row) => (
            <tr key={row.channel} className="border-b border-border/60">
              <td className="px-4 py-3 font-medium text-foreground">{row.channel}</td>
              <td className="px-4 py-3 capitalize text-foreground-muted">{row.sourceType}</td>
              <td className="px-4 py-3">{row.spend != null ? row.spend.toLocaleString("en-GB") : "—"}</td>
              <td className="px-4 py-3">
                {row.impressions != null ? row.impressions.toLocaleString("en-GB") : "—"}
              </td>
              <td className="px-4 py-3">{row.clicks != null ? row.clicks.toLocaleString("en-GB") : "—"}</td>
              <td className="px-4 py-3">
                {row.conversions != null ? row.conversions.toLocaleString("en-GB") : "—"}
                {row.providerReportedConversions != null && row.crescoTrackedConversions != null ? (
                  <span className="block text-[11px] text-foreground-subtle">
                    Provider: {row.providerReportedConversions} · Cresco: {row.crescoTrackedConversions}
                  </span>
                ) : null}
              </td>
              <td className="px-4 py-3">
                {row.attributedRevenue != null
                  ? row.attributedRevenue.toLocaleString("en-GB", {
                      style: "currency",
                      currency: "GBP",
                      maximumFractionDigits: 0,
                    })
                  : "—"}
              </td>
              <td className="px-4 py-3">
                {row.contributionPercent != null ? `${row.contributionPercent.toFixed(1)}%` : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="border-t border-border px-4 py-2 text-xs text-foreground-subtle">
        Contribution % is attribution-model dependent ({modelLabel}).
      </p>
    </section>
  );
}

export function ContentPanel({
  content,
}: {
  content: import("@/lib/unified-analytics/types").ContentAnalyticsRow[];
}) {
  if (content.length === 0) {
    return (
      <p className="text-sm text-foreground-muted">No content performance data for the selected period.</p>
    );
  }

  return (
    <section className="overflow-x-auto rounded-xl border border-border bg-surface-elevated">
      <table className="min-w-full text-sm">
        <thead className="border-b border-border bg-surface text-left text-xs uppercase tracking-wide text-foreground-subtle">
          <tr>
            <th className="px-4 py-3">Content</th>
            <th className="px-4 py-3">Organic reach</th>
            <th className="px-4 py-3">Attributed revenue</th>
            <th className="px-4 py-3">Assisted revenue</th>
            <th className="px-4 py-3">Channels</th>
          </tr>
        </thead>
        <tbody>
          {content.map((row) => (
            <tr key={row.contentId} className="border-b border-border/60">
              <td className="px-4 py-3 font-medium text-foreground">{row.title}</td>
              <td className="px-4 py-3">
                {row.organicReach != null ? row.organicReach.toLocaleString("en-GB") : "—"}
              </td>
              <td className="px-4 py-3">
                {row.attributedRevenue != null
                  ? row.attributedRevenue.toLocaleString("en-GB", {
                      style: "currency",
                      currency: "GBP",
                      maximumFractionDigits: 0,
                    })
                  : "—"}
              </td>
              <td className="px-4 py-3">
                {row.assistedRevenue != null
                  ? row.assistedRevenue.toLocaleString("en-GB", {
                      style: "currency",
                      currency: "GBP",
                      maximumFractionDigits: 0,
                    })
                  : "—"}
              </td>
              <td className="px-4 py-3 text-foreground-muted">{row.channels.join(", ") || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="border-t border-border px-4 py-2 text-xs text-foreground-subtle">
        Assisted revenue counts journeys where content appeared before conversion. It is not attributed
        credit.
      </p>
    </section>
  );
}

export function FunnelPanel({
  funnel,
}: {
  funnel: import("@/lib/unified-analytics/types").FunnelStage[];
}) {
  const visibleStages = funnel.filter((stage) => stage.count != null);
  if (visibleStages.length === 0) {
    return <p className="text-sm text-foreground-muted">Insufficient data to render a funnel.</p>;
  }

  return (
    <section className="rounded-xl border border-border bg-surface-elevated p-4 sm:p-5">
      <ol className="space-y-3">
        {visibleStages.map((stage, index) => (
          <li
            key={stage.stage}
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface px-4 py-3"
          >
            <div>
              <p className="text-sm font-semibold text-foreground">{stage.stage}</p>
              {stage.conversionRate != null ? (
                <p className="text-xs text-foreground-subtle">
                  Stage conversion rate: {stage.conversionRate.toFixed(1)}%
                </p>
              ) : null}
            </div>
            <div className="text-right">
              <p className="text-lg font-semibold text-foreground">
                {stage.count != null ? stage.count.toLocaleString("en-GB") : "—"}
              </p>
              {stage.dropOffPercent != null && index > 0 ? (
                <p className="text-xs text-warning">{stage.dropOffPercent.toFixed(1)}% drop-off</p>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function ConversionsPanel({
  conversions,
}: {
  conversions: import("@/lib/unified-analytics/types").ConversionRow[];
}) {
  if (conversions.length === 0) {
    return <p className="text-sm text-foreground-muted">No conversion analytics for the selected period.</p>;
  }

  return (
    <section className="overflow-x-auto rounded-xl border border-border bg-surface-elevated">
      <table className="min-w-full text-sm">
        <thead className="border-b border-border bg-surface text-left text-xs uppercase tracking-wide text-foreground-subtle">
          <tr>
            <th className="px-4 py-3">Type</th>
            <th className="px-4 py-3">Count</th>
            <th className="px-4 py-3">Channel</th>
            <th className="px-4 py-3">Revenue</th>
            <th className="px-4 py-3">Model</th>
          </tr>
        </thead>
        <tbody>
          {conversions.map((row) => (
            <tr key={row.id} className="border-b border-border/60">
              <td className="px-4 py-3">{row.conversionType}</td>
              <td className="px-4 py-3">{row.count.toLocaleString("en-GB")}</td>
              <td className="px-4 py-3">{row.attributedChannel ?? "—"}</td>
              <td className="px-4 py-3">
                {row.revenue != null
                  ? row.revenue.toLocaleString("en-GB", {
                      style: "currency",
                      currency: "GBP",
                      maximumFractionDigits: 0,
                    })
                  : "—"}
              </td>
              <td className="px-4 py-3 text-foreground-muted">{row.model}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export function RevenuePanel({
  revenue,
  unattributed,
}: {
  revenue: import("@/lib/unified-analytics/types").RevenueBreakdown;
  unattributed: { conversions: number; revenue: number | null };
}) {
  const formatMoney = (value: number | null) =>
    value != null
      ? value.toLocaleString("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 })
      : "Unavailable";

  return (
    <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {[
        { label: "Observed revenue", value: formatMoney(revenue.observedRevenue), kind: "Observed" },
        { label: "Attributed revenue", value: formatMoney(revenue.attributedRevenue), kind: "Attributed" },
        {
          label: "Unattributed / outside coverage",
          value: formatMoney(revenue.unattributedRevenue ?? unattributed.revenue),
          kind: "Calculated",
        },
        {
          label: "Paid-attributed revenue",
          value: formatMoney(revenue.paidAttributedRevenue),
          kind: "Attributed",
        },
        {
          label: "Content-assisted revenue",
          value: formatMoney(revenue.organicAssistedRevenue),
          kind: "Calculated",
        },
        {
          label: "Attribution coverage",
          value:
            revenue.attributionCoverage != null
              ? `${revenue.attributionCoverage.toFixed(0)}%`
              : "Unavailable",
          kind: "Calculated",
        },
      ].map((card) => (
        <div key={card.label} className="rounded-xl border border-border bg-surface-elevated p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-foreground-subtle">
            {card.label}
          </p>
          <p className="mt-2 text-2xl font-semibold text-foreground">{card.value}</p>
          <p className="mt-1 text-[11px] text-foreground-subtle">{card.kind}</p>
        </div>
      ))}
      {unattributed.conversions > 0 ? (
        <div className="rounded-xl border border-warning/30 bg-warning-muted p-4 sm:col-span-2 lg:col-span-3">
          <p className="text-sm text-foreground">
            {unattributed.conversions.toLocaleString("en-GB")} conversions remain unattributed to
            marketing touchpoints in the selected period.
          </p>
        </div>
      ) : null}
    </section>
  );
}

export function AttributionPanel({
  modelOptions,
  selectedModel,
  modelComparison,
  organicAssist,
  journeyFlows,
  lookbackWindowDays,
  disclaimer,
  attributionConfidence,
  unattributed,
}: {
  modelOptions: import("@/lib/unified-analytics/types").AttributionModelOption[];
  selectedModel: string;
  modelComparison: import("@/lib/unified-analytics/types").ModelComparisonRow[];
  organicAssist: import("@/lib/unified-analytics/types").OrganicAssistSummary;
  journeyFlows: import("@/lib/unified-analytics/types").JourneyFlow[];
  lookbackWindowDays: number;
  disclaimer: string;
  attributionConfidence: import("@/lib/unified-analytics/types").AttributionConfidenceSummary;
  unattributed: { conversions: number; revenue: number | null };
}) {
  const selected = modelOptions.find((option) => option.type === selectedModel);

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-border bg-surface-elevated p-4 sm:p-5">
        <h2 className="text-sm font-semibold text-foreground">Attribution model</h2>
        <p className="mt-2 text-sm text-foreground-muted">
          {selected?.label ?? selectedModel}: {selected?.description}
          {selected?.maturity === "advanced" ? " This model is marked Advanced and has not completed full launch validation." : ""}
        </p>
        <p className="mt-2 text-xs text-foreground-subtle">
          Lookback window: {lookbackWindowDays} days · {disclaimer}
        </p>
      </section>

      <section className="rounded-xl border border-border bg-surface-elevated p-4 sm:p-5">
        <h2 className="text-sm font-semibold text-foreground">Attribution confidence & coverage</h2>
        <p className="mt-2 text-sm text-foreground-muted">{attributionConfidence.label}</p>
        <div className="mt-3 flex flex-wrap gap-4 text-sm">
          <span>
            Confidence: <strong>{attributionConfidence.level}</strong>
          </span>
          {attributionConfidence.sourceCoveragePercent != null ? (
            <span>Source coverage: {attributionConfidence.sourceCoveragePercent}%</span>
          ) : null}
          {attributionConfidence.journeyCoveragePercent != null ? (
            <span>Journey coverage: {attributionConfidence.journeyCoveragePercent}%</span>
          ) : null}
        </div>
        {attributionConfidence.limitations.length > 0 ? (
          <ul className="mt-3 space-y-1 text-xs text-warning">
            {attributionConfidence.limitations.map((limitation) => (
              <li key={limitation}>{limitation}</li>
            ))}
          </ul>
        ) : null}
        {unattributed.conversions > 0 ? (
          <p className="mt-3 text-sm text-foreground">
            {unattributed.conversions.toLocaleString("en-GB")} conversions and{" "}
            {unattributed.revenue != null
              ? unattributed.revenue.toLocaleString("en-GB", {
                  style: "currency",
                  currency: "GBP",
                  maximumFractionDigits: 0,
                })
              : "unavailable revenue"}{" "}
            remain unattributed.
          </p>
        ) : null}
      </section>

      <section className="rounded-xl border border-border bg-surface-elevated p-4 sm:p-5">
        <h2 className="text-sm font-semibold text-foreground">Organic assist intelligence</h2>
        <p className="mt-2 text-sm text-foreground-muted">{organicAssist.description}</p>
        {organicAssist.rate != null ? (
          <p className="mt-2 text-2xl font-semibold text-foreground">{organicAssist.rate.toFixed(0)}%</p>
        ) : null}
        {organicAssist.topAssistingChannel ? (
          <p className="mt-1 text-xs text-foreground-subtle">
            Top assisting channel: {organicAssist.topAssistingChannel}
          </p>
        ) : null}
      </section>

      {modelComparison.length > 0 ? (
        <section className="rounded-xl border border-border bg-surface-elevated p-4 sm:p-5">
          <h2 className="text-sm font-semibold text-foreground">Model comparison</h2>
          <p className="mt-1 text-xs text-foreground-subtle">
            Conclusions change by model. No model is objectively correct.
          </p>
          <ul className="mt-4 space-y-2">
            {modelComparison.slice(0, 12).map((row) => (
              <li
                key={`${row.modelType}-${row.channel}`}
                className="flex items-center justify-between rounded-lg border border-border bg-surface px-3 py-2 text-sm"
              >
                <span>
                  {row.modelLabel} · {row.channel}
                </span>
                <span className="font-medium">{row.contributionPercent.toFixed(0)}%</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {journeyFlows.length > 0 ? (
        <section className="rounded-xl border border-border bg-surface-elevated p-4 sm:p-5">
          <h2 className="text-sm font-semibold text-foreground">Top journey paths</h2>
          <ul className="mt-4 space-y-2">
            {journeyFlows.map((flow) => (
              <li
                key={flow.path.join("→")}
                className="rounded-lg border border-border bg-surface px-3 py-2 text-sm"
              >
                <p className="font-medium text-foreground">{flow.path.join(" → ")}</p>
                <p className="text-xs text-foreground-subtle">
                  {flow.conversions} conversions
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
