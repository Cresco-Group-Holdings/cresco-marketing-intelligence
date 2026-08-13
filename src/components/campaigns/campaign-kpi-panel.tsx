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
          <p className="text-sm text-slate-600">No KPIs defined for this campaign.</p>
        ) : (
          <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
            {kpis.map((kpi) => (
              <div key={kpi.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-slate-900">{kpi.name}</p>
                  {kpi.unit ? <p className="text-xs text-slate-500">Unit: {kpi.unit}</p> : null}
                </div>
                <div className="text-right text-sm text-slate-700">
                  {kpi.currentValue != null ? (
                    <span>
                      {kpi.currentValue}
                      {kpi.targetValue != null ? ` / ${kpi.targetValue}` : ""}
                    </span>
                  ) : kpi.targetValue != null ? (
                    <span>Target: {kpi.targetValue}</span>
                  ) : (
                    <span className="text-slate-500">No target set</span>
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
