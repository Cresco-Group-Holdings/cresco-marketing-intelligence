"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button, ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { apiFetch } from "@/lib/api/client";
import { REPORT_TYPE_LABELS } from "@/lib/reports/constants";

type Mode = "list" | "builder" | "preview";

type ReportSummary = {
  id: string;
  title: string;
  reportType: keyof typeof REPORT_TYPE_LABELS;
  status: string;
  periodStart: string;
  periodEnd: string;
  shareStatus: string;
  createdAt: string;
};

type ReportDetail = ReportSummary & {
  timezone: string;
  customNotes: string | null;
  includeCrescoBranding: boolean;
  narrative: {
    executiveSummary?: string;
    keyImprovements?: string[];
    recommendedActions?: string[];
    dataLimitations?: string[];
  } | null;
  dataLimitations: string[];
  sections: Array<{
    id: string;
    sectionType: string;
    title: string;
    content: Record<string, unknown>;
  }>;
};

const reportTypes = Object.entries(REPORT_TYPE_LABELS);

export function SocialReportsView({
  mode,
  reportId,
}: {
  mode: Mode;
  reportId?: string;
}) {
  const { preference } = useWorkspace();
  const brandId = preference.currentBrandId;
  const organisationId = preference.currentOrganisationId;

  const [reports, setReports] = useState<ReportSummary[]>([]);
  const [detail, setDetail] = useState<ReportDetail | null>(null);
  const [title, setTitle] = useState("Weekly social performance");
  const [reportType, setReportType] = useState("WEEKLY_PERFORMANCE");
  const [days, setDays] = useState("7");
  const [timezone, setTimezone] = useState("UTC");
  const [customNotes, setCustomNotes] = useState("");
  const [includeBranding, setIncludeBranding] = useState(true);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const period = useMemo(() => {
    const to = new Date();
    const from = new Date(to.getTime() - Number(days) * 86_400_000);
    return { from: from.toISOString(), to: to.toISOString() };
  }, [days]);

  const loadReports = useCallback(async () => {
    if (!brandId || !organisationId) return;
    setLoading(true);
    try {
      setReports(
        await apiFetch<ReportSummary[]>(
          `/api/brands/${brandId}/reports?organisationId=${organisationId}`,
          { organisationId },
        ),
      );
    } finally {
      setLoading(false);
    }
  }, [brandId, organisationId]);

  const loadDetail = useCallback(
    async (id: string) => {
      if (!brandId || !organisationId) return;
      setDetail(
        await apiFetch<ReportDetail>(
          `/api/brands/${brandId}/reports/${id}?organisationId=${organisationId}`,
          { organisationId },
        ),
      );
    },
    [brandId, organisationId],
  );

  useEffect(() => {
    if (mode === "list" || mode === "builder") void loadReports();
    if ((mode === "preview" || mode === "list") && reportId) void loadDetail(reportId);
  }, [mode, reportId, loadReports, loadDetail]);

  async function generateReport() {
    if (!brandId || !organisationId) return;
    setLoading(true);
    setMessage(null);
    try {
      const created = await apiFetch<ReportDetail>(
        `/api/brands/${brandId}/reports?organisationId=${organisationId}`,
        {
          method: "POST",
          organisationId,
          body: JSON.stringify({
            reportType,
            title,
            periodStart: period.from,
            periodEnd: period.to,
            timezone,
            customNotes,
            includeCrescoBranding: includeBranding,
            generateNarrative: true,
          }),
        },
      );
      setMessage("Report generated.");
      setDetail(created);
      await loadReports();
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Failed to generate report.");
    } finally {
      setLoading(false);
    }
  }

  async function enableShare() {
    if (!brandId || !organisationId || !detail) return;
    const result = await apiFetch<{ sharePath?: string }>(
      `/api/brands/${brandId}/reports/${detail.id}?action=share&organisationId=${organisationId}`,
      {
        method: "POST",
        organisationId,
        body: JSON.stringify({ enable: true, expiresInDays: 30 }),
      },
    );
    setMessage(result.sharePath ? `Share link created: ${result.sharePath}` : "Sharing updated.");
    await loadDetail(detail.id);
  }

  const preview = detail ?? (reportId ? null : null);

  return (
    <div className="space-y-6">
      <PageHeader
        title={mode === "builder" ? "Report builder" : mode === "preview" ? "Report preview" : "Social reports"}
        description="Generate evidence-based social performance reports from synchronised analytics data."
        actions={
          <div className="flex flex-wrap gap-2">
            <ButtonLink href="/analytics/social/reports" size="sm" variant={mode === "list" ? "primary" : "outline"}>
              Reports
            </ButtonLink>
            <ButtonLink href="/analytics/social/reports/builder" size="sm" variant={mode === "builder" ? "primary" : "outline"}>
              Builder
            </ButtonLink>
          </div>
        }
      />

      {message && <p className="text-sm text-muted-foreground">{message}</p>}
      {loading && <p className="text-sm text-muted-foreground">Loading…</p>}

      {mode === "builder" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Configure report</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <Input label="Report title" value={title} onChange={(e) => setTitle(e.target.value)} />
            <label className="text-sm">
              Report type
              <select
                className="mt-1 w-full rounded-md border px-3 py-2"
                value={reportType}
                onChange={(e) => setReportType(e.target.value)}
              >
                {reportTypes.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <Input label="Period (days)" value={days} onChange={(e) => setDays(e.target.value)} />
            <Input label="Timezone" value={timezone} onChange={(e) => setTimezone(e.target.value)} />
            <label className="text-sm md:col-span-2">
              Custom notes
              <textarea
                className="mt-1 min-h-24 w-full rounded-md border px-3 py-2"
                value={customNotes}
                onChange={(e) => setCustomNotes(e.target.value)}
              />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={includeBranding}
                onChange={(e) => setIncludeBranding(e.target.checked)}
              />
              Include Cresco branding
            </label>
            <div className="md:col-span-2">
              <Button onClick={() => void generateReport()}>Generate report</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {mode === "list" && (
        <div className="space-y-3">
          {reports.map((report) => (
            <Card key={report.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
                <div>
                  <p className="font-medium">
                    <Link href={`/analytics/social/reports/${report.id}`} className="hover:underline">
                      {report.title}
                    </Link>
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {REPORT_TYPE_LABELS[report.reportType]} ·{" "}
                    {new Date(report.periodStart).toLocaleDateString()} –{" "}
                    {new Date(report.periodEnd).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="muted">{report.status}</Badge>
                  <Badge variant="muted">{report.shareStatus}</Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {(mode === "preview" || (mode === "builder" && preview)) && preview && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <ButtonLink
              href={`/api/brands/${brandId}/reports/${preview.id}/export?organisationId=${organisationId}&format=PDF`}
              size="sm"
              variant="outline"
            >
              Export PDF
            </ButtonLink>
            <ButtonLink
              href={`/api/brands/${brandId}/reports/${preview.id}/export?organisationId=${organisationId}&format=CSV`}
              size="sm"
              variant="outline"
            >
              Export CSV
            </ButtonLink>
            <Button size="sm" variant="outline" onClick={() => void enableShare()}>
              Create share link
            </Button>
          </div>

          {preview.narrative?.executiveSummary && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Executive summary</CardTitle>
              </CardHeader>
              <CardContent className="text-sm">{preview.narrative.executiveSummary}</CardContent>
            </Card>
          )}

          {preview.sections?.map((section) => (
            <Card key={section.id}>
              <CardHeader>
                <CardTitle className="text-base">{section.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="overflow-x-auto text-xs">{JSON.stringify(section.content, null, 2)}</pre>
              </CardContent>
            </Card>
          ))}

          {preview.dataLimitations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Data limitations</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                {preview.dataLimitations.map((limitation) => (
                  <p key={limitation}>• {limitation}</p>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
