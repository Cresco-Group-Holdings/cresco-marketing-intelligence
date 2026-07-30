import type { ExecutiveOverviewPayload } from "@/server/services/executive-dashboard-service";

export type EvidenceMetric = {
  key: string;
  label: string;
  value: number | null;
  available: boolean;
  currency?: string | null;
  source?: string | null;
  formula?: string | null;
  changeAbsolute?: number | null;
  changePercent?: number | null;
  claimType: "MEASURED_FACT" | "DETERMINISTIC_CALCULATION" | "UNAVAILABLE";
};

export type EvidencePackage = {
  generatedAt: string;
  period: {
    from: string;
    to: string;
    comparisonFrom: string;
    comparisonTo: string;
  };
  reportingCurrency: string;
  metricDefinitions: Record<string, string>;
  metrics: EvidenceMetric[];
  dataSources: Array<{ name: string; lastUpdated: string | null; freshness: string | null }>;
  qualityWarnings: string[];
  attributionModel: string | null;
  anomalies: Array<{
    metricKey: string;
    direction: "UP" | "DOWN";
    changePercent: number;
    method: string;
    sampleSize: number;
  }>;
  relevantCampaigns: Array<{ id: string; name: string; provider: string; spend: number | null }>;
  relevantContent: Array<{ id: string; title: string; metricSummary: string | null }>;
  unavailableData: string[];
  formulaVersions: Record<string, string>;
};

export function buildEvidencePackage(input: {
  overview: ExecutiveOverviewPayload;
  warnings: Array<{ level: string; message: string }>;
  anomalies: EvidencePackage["anomalies"];
  dataHealth?: { warehouse?: { summary?: Record<string, number> } };
  attributionModel?: string | null;
  campaigns?: EvidencePackage["relevantCampaigns"];
  content?: EvidencePackage["relevantContent"];
}): EvidencePackage {
  const metrics: EvidenceMetric[] = Object.entries(input.overview.kpis).map(([key, kpi]) => ({
    key,
    label: key,
    value: kpi.available ? kpi.value : null,
    available: kpi.available,
    currency: kpi.currency,
    source: kpi.source,
    formula: kpi.formula ?? input.overview.formulaDefinitions[key] ?? null,
    changeAbsolute: kpi.changeAbsolute,
    changePercent: kpi.changePercent,
    claimType: kpi.available ? "MEASURED_FACT" : "UNAVAILABLE",
  }));

  const unavailableData = metrics.filter((m) => !m.available).map((m) => `${m.key}: ${m.formula ?? "not synced"}`);

  return {
    generatedAt: new Date().toISOString(),
    period: input.overview.period,
    reportingCurrency: input.overview.reportingCurrency,
    metricDefinitions: input.overview.formulaDefinitions,
    metrics,
    dataSources: [
      {
        name: "Executive dashboard aggregation",
        lastUpdated: new Date().toISOString(),
        freshness: input.dataHealth?.warehouse ? "warehouse monitored" : null,
      },
    ],
    qualityWarnings: input.warnings.map((w) => w.message),
    attributionModel: input.attributionModel ?? null,
    anomalies: input.anomalies,
    relevantCampaigns: input.campaigns ?? [],
    relevantContent: input.content ?? [],
    unavailableData,
    formulaVersions: input.overview.formulaDefinitions,
  };
}
