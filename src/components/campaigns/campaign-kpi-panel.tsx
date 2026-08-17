import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CampaignKpi } from "@/components/campaigns/types";

export function CampaignKpiPanel({ kpis }: { kpis: CampaignKpi[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">KPIs</CardTitle>
      </CardHeader>
      <CardContent>
        {kpis.length === 0 ? (
          <p className="text-sm text-foreground-muted">No KPIs defined for this campaign.</p>
        ) : (
          <div className="divide-y divide-border-subtle rounded-lg border border-border">
            {kpis.map((kpi) => (
              <div key={kpi.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-foreground">{kpi.name}</p>
                  {kpi.unit ? <p className="text-xs text-foreground-subtle">Unit: {kpi.unit}</p> : null}
                </div>
                <div className="text-right text-sm text-foreground-muted">
                  {kpi.currentValue != null ? (
                    <span>
                      {kpi.currentValue}
                      {kpi.targetValue != null ? ` / ${kpi.targetValue}` : ""}
                    </span>
                  ) : kpi.targetValue != null ? (
                    <span>Target: {kpi.targetValue}</span>
                  ) : (
                    <span className="text-foreground-subtle">No target set</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
