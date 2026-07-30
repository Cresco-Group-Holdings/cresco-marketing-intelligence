export type ForecastOpportunity = {
  id: string;
  status: string;
  probability: number;
  expectedValue: number;
  recurringValue?: number;
  currency: string;
  expectedCloseDate?: Date | null;
  stageCategory?: string;
  stageEnteredAt?: Date;
  createdAt?: Date;
  wonAt?: Date;
};

export type ForecastResult = {
  totalOpenValue: number;
  weightedValue: number;
  expectedCloseValue: number;
  wonValue: number;
  lostValue: number;
  openCount: number;
  wonCount: number;
  lostCount: number;
  stageConversion: Record<string, { entered: number; advanced: number; rate: number }>;
  stageVelocity: Record<string, { avgDays: number; count: number }>;
  averageSalesCycleDays: number | null;
  disclaimer: string;
};

export function computeWeightedValue(opportunities: ForecastOpportunity[]): number {
  return opportunities
    .filter((o) => o.status === "OPEN")
    .reduce((sum, o) => sum + o.expectedValue * (o.probability / 100), 0);
}

export function computeForecast(opportunities: ForecastOpportunity[]): ForecastResult {
  const open = opportunities.filter((o) => o.status === "OPEN");
  const won = opportunities.filter((o) => o.status === "WON");
  const lost = opportunities.filter((o) => o.status === "LOST");

  const totalOpenValue = open.reduce((s, o) => s + o.expectedValue, 0);
  const weightedValue = computeWeightedValue(opportunities);
  const now = new Date();
  const closingThisMonth = open.filter((o) => {
    if (!o.expectedCloseDate) return false;
    return o.expectedCloseDate.getMonth() === now.getMonth() && o.expectedCloseDate.getFullYear() === now.getFullYear();
  });
  const expectedCloseValue = closingThisMonth.reduce((s, o) => s + o.expectedValue, 0);
  const wonValue = won.reduce((s, o) => s + o.expectedValue, 0);
  const lostValue = lost.reduce((s, o) => s + o.expectedValue, 0);

  const stageConversion: ForecastResult["stageConversion"] = {};
  for (const o of opportunities) {
    const cat = o.stageCategory ?? "OPEN";
    if (!stageConversion[cat]) stageConversion[cat] = { entered: 0, advanced: 0, rate: 0 };
    stageConversion[cat].entered++;
    if (o.status === "WON" || (o.stageCategory && o.stageCategory !== "OPEN")) {
      stageConversion[cat].advanced++;
    }
  }
  for (const cat of Object.keys(stageConversion)) {
    const s = stageConversion[cat];
    s.rate = s.entered > 0 ? Math.round((s.advanced / s.entered) * 100) : 0;
  }

  const stageVelocity: ForecastResult["stageVelocity"] = {};
  for (const o of open) {
    const cat = o.stageCategory ?? "OPEN";
    if (!o.stageEnteredAt) continue;
    const days = Math.max(0, (now.getTime() - o.stageEnteredAt.getTime()) / 86_400_000);
    if (!stageVelocity[cat]) stageVelocity[cat] = { avgDays: 0, count: 0 };
    stageVelocity[cat].avgDays += days;
    stageVelocity[cat].count++;
  }
  for (const cat of Object.keys(stageVelocity)) {
    const s = stageVelocity[cat];
    s.avgDays = s.count > 0 ? Math.round(s.avgDays / s.count) : 0;
  }

  const wonCycles = won
    .filter((o) => o.createdAt && o.wonAt)
    .map((o) => (o.wonAt!.getTime() - o.createdAt!.getTime()) / 86_400_000);
  const averageSalesCycleDays =
    wonCycles.length > 0 ? Math.round(wonCycles.reduce((a, b) => a + b, 0) / wonCycles.length) : null;

  return {
    totalOpenValue,
    weightedValue,
    expectedCloseValue,
    wonValue,
    lostValue,
    openCount: open.length,
    wonCount: won.length,
    lostCount: lost.length,
    stageConversion,
    stageVelocity,
    averageSalesCycleDays,
    disclaimer:
      "Weighted pipeline value is a deterministic estimate (value × probability). Not predictive forecasting.",
  };
}
