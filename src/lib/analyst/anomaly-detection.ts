import type { MetricComparison } from "@/lib/executive/types";

export type AnomalyResult = {
  metricKey: string;
  direction: "UP" | "DOWN";
  changePercent: number;
  currentValue: number;
  previousValue: number;
  method: "PERCENTAGE_THRESHOLD" | "MINIMUM_VOLUME";
  sampleSize: number;
  isSignificant: boolean;
};

const MIN_VOLUME = 10;
const PERCENT_THRESHOLD = 25;

export function detectAnomalies(
  kpis: Record<string, MetricComparison>,
  options?: { percentThreshold?: number; minVolume?: number },
): AnomalyResult[] {
  const threshold = options?.percentThreshold ?? PERCENT_THRESHOLD;
  const minVolume = options?.minVolume ?? MIN_VOLUME;
  const anomalies: AnomalyResult[] = [];

  for (const [key, kpi] of Object.entries(kpis)) {
    if (!kpi.available || !kpi.previous.available) continue;
    if (kpi.value == null || kpi.previous.value == null) continue;

    const current = kpi.value;
    const previous = kpi.previous.value;
    const sampleSize = Math.max(current, previous);

    if (sampleSize < minVolume) continue;
    if (previous === 0) continue;

    const changePercent = ((current - previous) / previous) * 100;
    if (Math.abs(changePercent) < threshold) continue;

    anomalies.push({
      metricKey: key,
      direction: changePercent >= 0 ? "UP" : "DOWN",
      changePercent: Math.round(changePercent * 100) / 100,
      currentValue: current,
      previousValue: previous,
      method: sampleSize >= minVolume ? "PERCENTAGE_THRESHOLD" : "MINIMUM_VOLUME",
      sampleSize,
      isSignificant: true,
    });
  }

  return anomalies.sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent));
}
