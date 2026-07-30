export type ExecutiveSection =
  | "overview"
  | "acquisition"
  | "social"
  | "search"
  | "advertising"
  | "funnel"
  | "attribution"
  | "leads"
  | "revenue"
  | "data-health"
  | "objectives"
  | "warnings";

export type MetricValue = {
  available: boolean;
  value: number | null;
  currency?: string | null;
  source?: string | null;
  lastUpdated?: string | null;
  freshness?: string | null;
  formula?: string | null;
  unavailableReason?: string | null;
};

export type MetricComparison = MetricValue & {
  previous: MetricValue;
  changeAbsolute: number | null;
  changePercent: number | null;
};

export type DataConfidence = {
  source: string;
  lastUpdated: string | null;
  freshness: string | null;
  qualityWarnings: string[];
  attributionModel?: string | null;
  currency?: string | null;
  formula?: string | null;
};

export type ExecutiveFilters = {
  channel?: string | null;
  country?: string | null;
  campaign?: string | null;
  projectId?: string | null;
  compareBrandId?: string | null;
  compareProjectId?: string | null;
};

export type ExecutiveDateRange = {
  from: Date;
  to: Date;
  comparisonFrom: Date;
  comparisonTo: Date;
};

export type SectionResult<T> = {
  data: T | null;
  error: string | null;
  confidence: DataConfidence | null;
};
