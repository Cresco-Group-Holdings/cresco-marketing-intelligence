"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { apiFetch } from "@/lib/api/client";
import {
  LEAD_CREATION_SOURCE_LABELS,
  LEAD_QUALIFICATION_PROFILE_LABELS,
  MARKETING_LEAD_STATUS_LABELS,
} from "@/lib/leads/constants";

type Mode = "all" | "qualified" | "export" | "detail";

const nav = [
  ["All leads", "/leads"],
  ["Qualified", "/leads/qualified"],
  ["Export", "/leads/export"],
] as const;

type LeadListItem = {
  id: string;
  status: string;
  displayName: string | null;
  email: string | null;
  company: string | null;
  country: string | null;
  expressedInterest: string | null;
  sourcePlatform: string | null;
  isDuplicateWarning: boolean;
  latestInteractionAt: string | null;
  source: { creationSource: string; campaignName: string | null } | null;
  socialAccount: { id: string; username: string | null; displayName: string | null; provider: string } | null;
  contentItem: { id: string; title: string; campaignName: string | null } | null;
  qualifications: Array<{ profile: string; qualified: boolean | null; requiresReview: boolean }>;
  assignments: Array<{ assignedTo: { displayName: string | null; email: string } }>;
};

type LeadDetail = LeadListItem & {
  phone: string | null;
  jobRole: string | null;
  providerUsername: string | null;
  providerProfileUrl: string | null;
  originalInteraction: string | null;
  sourcePostId: string | null;
  sourceCampaign: string | null;
  primaryCta: string | null;
  destinationUrl: string | null;
  socialConversationId: string | null;
  activities: Array<{ id: string; activityType: string; summary: string; createdAt: string }>;
  consents: Array<{ consentState: string; marketingOptIn: boolean; suppressed: boolean }>;
  crmHandoffs: Array<{ provider: string; status: string; externalId: string | null }>;
  duplicateOf: { id: string; displayName: string | null } | null;
};

export function MarketingLeadsView({
  mode,
  leadId,
}: {
  mode: Mode;
  leadId?: string;
}) {
  const { preference } = useWorkspace();
  const brandId = preference.currentBrandId;
  const organisationId = preference.currentOrganisationId;

  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [summary, setSummary] = useState<{
    total: number;
    qualified: number;
    reviewing: number;
    duplicateWarnings: number;
    unreadNew: number;
  } | null>(null);
  const [list, setList] = useState<{ items: LeadListItem[]; nextCursor: string | null } | null>(null);
  const [detail, setDetail] = useState<LeadDetail | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(leadId ?? null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const listQuery = useMemo(() => {
    const params = new URLSearchParams({ organisationId: organisationId ?? "" });
    if (status) params.set("status", status);
    if (search.trim()) params.set("search", search.trim());
    if (mode === "qualified") params.set("qualifiedOnly", "true");
    return params.toString();
  }, [organisationId, status, search, mode]);

  const loadList = useCallback(async () => {
    if (!brandId || !organisationId || mode === "export") return;
    setLoading(true);
    try {
      const data = await apiFetch<{
        summary: typeof summary;
        items: LeadListItem[];
        nextCursor: string | null;
      }>(`/api/brands/${brandId}/leads?${listQuery}`, { organisationId });
      setSummary(data.summary);
      setList({ items: data.items, nextCursor: data.nextCursor });
    } finally {
      setLoading(false);
    }
  }, [brandId, organisationId, listQuery, mode]);

  const loadDetail = useCallback(
    async (id: string) => {
      if (!brandId || !organisationId) return;
      setDetail(await apiFetch<LeadDetail>(`/api/brands/${brandId}/leads/${id}?organisationId=${organisationId}`, { organisationId }));
    },
    [brandId, organisationId],
  );

  useEffect(() => {
    void loadList();
  }, [loadList]);

  useEffect(() => {
    const id = leadId ?? selectedId;
    if (id) void loadDetail(id);
    else setDetail(null);
  }, [leadId, selectedId, loadDetail]);

  async function postAction(action: string, body: Record<string, unknown>, id = selectedId ?? leadId) {
    if (!brandId || !organisationId || !id) return;
    try {
      const result = await apiFetch<Record<string, unknown>>(
        `/api/brands/${brandId}/leads/${id}/actions?action=${action}&organisationId=${organisationId}`,
        { method: "POST", organisationId, body: JSON.stringify(body) },
      );
      if (action === "suggest-qualification" && result.suggestion) {
        setActionMessage("AI qualification suggestion ready for human review.");
      } else {
        setActionMessage(`${action} completed.`);
      }
      await loadList();
      await loadDetail(id);
    } catch (caught) {
      setActionMessage(caught instanceof Error ? caught.message : "Action failed.");
    }
  }

  async function downloadExport(format: "CSV" | "JSON") {
    if (!brandId || !organisationId) return;
    const params = new URLSearchParams({ organisationId, format });
    if (mode === "qualified") params.set("qualifiedOnly", "true");
    window.open(`/api/brands/${brandId}/leads/export?${params.toString()}`, "_blank");
  }

  if (mode === "export") {
    return (
      <>
        <PageHeader
          title="Export leads"
          description="Download privacy-minimised lead exports. Live CRM integrations are not claimed unless configured."
          breadcrumbs={[{ label: "Leads", href: "/leads" }, { label: "Export" }]}
        />
        <Card>
          <CardContent className="space-y-3 pt-6">
            <p className="text-sm text-foreground-muted">
              Exports include only necessary fields and respect consent state. Leads are never
              automatically subscribed to email marketing.
            </p>
            <div className="flex gap-2">
              <Button onClick={() => void downloadExport("CSV")}>Download CSV</Button>
              <Button variant="outline" onClick={() => void downloadExport("JSON")}>
                Download JSON
              </Button>
            </div>
          </CardContent>
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Marketing leads"
        description="Convert genuine social enquiries into traceable, privacy-governed leads."
        breadcrumbs={[{ label: "Leads", href: "/leads" }, { label: mode }]}
      />
      <nav className="mb-4 flex flex-wrap gap-2">
        {nav.map(([label, href]) => (
          <Link key={href} className="text-sm underline" href={href}>
            {label}
          </Link>
        ))}
      </nav>

      {summary ? (
        <div className="mb-4 grid gap-3 md:grid-cols-5">
          <Card><CardHeader><CardTitle>Total</CardTitle></CardHeader><CardContent>{summary.total}</CardContent></Card>
          <Card><CardHeader><CardTitle>Qualified</CardTitle></CardHeader><CardContent>{summary.qualified}</CardContent></Card>
          <Card><CardHeader><CardTitle>Reviewing</CardTitle></CardHeader><CardContent>{summary.reviewing}</CardContent></Card>
          <Card><CardHeader><CardTitle>New</CardTitle></CardHeader><CardContent>{summary.unreadNew}</CardContent></Card>
          <Card><CardHeader><CardTitle>Duplicates</CardTitle></CardHeader><CardContent>{summary.duplicateWarnings}</CardContent></Card>
        </div>
      ) : null}

      <div className="mb-4 grid gap-3 md:grid-cols-3">
        <select className="rounded-md border px-3 py-2 text-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {Object.entries(MARKETING_LEAD_STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <Input label="Search" value={search} onChange={(e) => setSearch(e.target.value)} />
        <Button variant="outline" onClick={() => void loadList()}>Refresh</Button>
      </div>

      {actionMessage ? <p className="mb-3 text-sm text-foreground-muted">{actionMessage}</p> : null}

      <div className={`grid gap-4 ${mode === "detail" || selectedId ? "lg:grid-cols-2" : ""}`}>
        {mode !== "detail" ? (
          <Card>
            <CardHeader><CardTitle>Leads</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {loading ? <p className="text-sm text-foreground-muted">Loading…</p> : null}
              {list?.items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`w-full rounded-lg border p-3 text-left text-sm ${selectedId === item.id ? "border-primary bg-surface-subtle" : "border-border"}`}
                  onClick={() => setSelectedId(item.id)}
                >
                  <div className="mb-1 flex flex-wrap gap-2">
                    <span className="font-medium">{item.displayName ?? item.email ?? "Lead"}</span>
                    <Badge variant="muted">{MARKETING_LEAD_STATUS_LABELS[item.status as keyof typeof MARKETING_LEAD_STATUS_LABELS] ?? item.status}</Badge>
                    {item.isDuplicateWarning ? <Badge variant="warning">Possible duplicate</Badge> : null}
                  </div>
                  <p className="text-foreground-muted">
                    {item.source ? LEAD_CREATION_SOURCE_LABELS[item.source.creationSource as keyof typeof LEAD_CREATION_SOURCE_LABELS] : "Unknown source"}
                    {item.company ? ` · ${item.company}` : ""}
                  </p>
                </button>
              ))}
            </CardContent>
          </Card>
        ) : null}

        {(mode === "detail" || selectedId) && detail ? (
          <Card>
            <CardHeader><CardTitle>Lead detail</CardTitle></CardHeader>
            <CardContent className="space-y-4 text-sm">
              {detail.isDuplicateWarning ? (
                <Badge variant="warning">
                  Possible duplicate{detail.duplicateOf ? ` of ${detail.duplicateOf.displayName ?? detail.duplicateOf.id}` : ""}
                </Badge>
              ) : null}
              <p><strong>Interest:</strong> {detail.expressedInterest ?? detail.originalInteraction ?? "—"}</p>
              <p><strong>Email:</strong> {detail.email ?? "—"} · <strong>Phone:</strong> {detail.phone ?? "—"}</p>
              <p><strong>Source:</strong> {detail.source ? LEAD_CREATION_SOURCE_LABELS[detail.source.creationSource as keyof typeof LEAD_CREATION_SOURCE_LABELS] : "—"}</p>
              {detail.contentItem ? (
                <div className="rounded border bg-surface-subtle p-3">
                  <p className="font-medium">Related content</p>
                  <p>{detail.contentItem.title}</p>
                  {detail.contentItem.campaignName ? <p className="text-foreground-muted">{detail.contentItem.campaignName}</p> : null}
                </div>
              ) : null}
              {detail.socialConversationId ? (
                <p><strong>Conversation:</strong> {detail.socialConversationId}</p>
              ) : null}
              <div>
                <p className="mb-2 font-medium">Activity</p>
                <div className="max-h-40 space-y-2 overflow-y-auto">
                  {detail.activities.map((activity) => (
                    <p key={activity.id} className="text-foreground-muted">
                      {activity.activityType}: {activity.summary}
                    </p>
                  ))}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => void postAction("suggest-qualification", { profile: "CRESCO_GRANTS_INTELLIGENCE" })}>
                  AI suggest (Grants)
                </Button>
                <Button size="sm" variant="outline" onClick={() => void postAction("crm-handoff", { provider: "FAKE", idempotencyKey: `handoff:${detail.id}:${Date.now()}` })}>
                  Test CRM handoff
                </Button>
                <Button size="sm" variant="outline" onClick={() => void postAction("export-record", {})}>
                  Export record
                </Button>
              </div>
              {detail.qualifications.length > 0 ? (
                <div>
                  <p className="font-medium">Qualification</p>
                  {detail.qualifications.map((q) => (
                    <p key={q.profile}>
                      {LEAD_QUALIFICATION_PROFILE_LABELS[q.profile as keyof typeof LEAD_QUALIFICATION_PROFILE_LABELS]} — {q.qualified ? "Qualified" : "Pending"}
                      {q.requiresReview ? " (review required)" : ""}
                    </p>
                  ))}
                </div>
              ) : null}
            </CardContent>
          </Card>
        ) : null}
      </div>
    </>
  );
}
