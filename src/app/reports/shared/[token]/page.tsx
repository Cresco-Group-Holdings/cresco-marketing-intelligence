"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiFetch } from "@/lib/api/client";

type SharedReport = {
  title: string;
  periodStart: string;
  periodEnd: string;
  timezone: string;
  narrative: { executiveSummary?: string } | null;
  sections: Array<{ title: string; content: Record<string, unknown> }>;
  dataLimitations: string[];
};

export default function SharedReportPage() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const [report, setReport] = useState<SharedReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    void apiFetch<SharedReport>(`/api/reports/shared/${token}`)
      .then(setReport)
      .catch((caught) => setError(caught instanceof Error ? caught.message : "Report unavailable."));
  }, [token]);

  if (error) return <p className="p-8 text-sm text-danger">{error}</p>;
  if (!report) return <p className="p-8 text-sm text-muted-foreground">Loading shared report…</p>;

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-8">
      <div>
        <h1 className="text-2xl font-semibold">{report.title}</h1>
        <p className="text-sm text-muted-foreground">
          {new Date(report.periodStart).toLocaleDateString()} –{" "}
          {new Date(report.periodEnd).toLocaleDateString()} ({report.timezone})
        </p>
      </div>

      {report.narrative?.executiveSummary && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Executive summary</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">{report.narrative.executiveSummary}</CardContent>
        </Card>
      )}

      {report.sections.map((section) => (
        <Card key={section.title}>
          <CardHeader>
            <CardTitle className="text-base">{section.title}</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="overflow-x-auto text-xs">{JSON.stringify(section.content, null, 2)}</pre>
          </CardContent>
        </Card>
      ))}

      {report.dataLimitations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Data limitations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            {report.dataLimitations.map((item) => (
              <p key={item}>• {item}</p>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
