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

export type AudienceIntelligenceViewMode =
  | "list"
  | "new"
  | "detail"
  | "rules"
  | "eligibility"
  | "privacy"
  | "history";

type Audience = {
  id: string;
  name: string;
  description?: string | null;
  status: string;
  audienceType: string;
  retargetingWindowDays?: number | null;
  dataSources?: string[];
  funnelStage?: string | null;
  messageAngle?: string | null;
  rules?: Array<{ id: string; ruleKey: string; operator: string }>;
  exclusions?: Array<{ id: string; exclusionType: string; description?: string | null }>;
  estimates?: Array<{ eligibleCount?: number | null; excludedCount?: number | null; consentCoveredCount?: number | null }>;
  consentPolicy?: Record<string, unknown> | null;
  providerMappings?: Array<{ provider: string; eligibilityStatus: string; policyWarnings: string[] }>;
  eligibilityChecks?: Array<{ id: string; checkType: string; status: string; title: string; description: string }>;
  versions?: Array<{ id: string; versionNumber: number; changeNote?: string | null }>;
  campaignPlan?: { id: string; name: string } | null;
};

const STATUS_VARIANT: Record<string, "default" | "muted" | "warning"> = {
  DRAFT: "muted",
  IN_REVIEW: "warning",
  APPROVED: "default",
  CHANGES_REQUESTED: "warning",
};

const AUDIENCE_TYPES = [
  "PROSPECTING", "RETARGETING", "CUSTOMER", "LEAD", "WEBSITE_VISITOR", "CONTENT_ENGAGER", "EXCLUSION",
];

const RETARGETING_WINDOWS = [1, 7, 14, 30, 60, 90, 180];

function AudienceNav({ audienceId, active }: { audienceId: string; active: AudienceIntelligenceViewMode }) {
  const tabs = [
    { mode: "detail" as const, label: "Overview", href: `/advertising/audiences/${audienceId}` },
    { mode: "rules" as const, label: "Rules", href: `/advertising/audiences/${audienceId}/rules` },
    { mode: "eligibility" as const, label: "Eligibility", href: `/advertising/audiences/${audienceId}/eligibility` },
    { mode: "privacy" as const, label: "Privacy", href: `/advertising/audiences/${audienceId}/privacy` },
    { mode: "history" as const, label: "History", href: `/advertising/audiences/${audienceId}/history` },
  ];
  return (
    <nav className="flex flex-wrap gap-2 border-b border-border pb-3">
      {tabs.map((tab) => (
        <Link key={tab.mode} href={tab.href}
          className={`rounded-md px-3 py-1.5 text-sm font-medium ${active === tab.mode ? "bg-primary text-primary-foreground" : "text-foreground-muted hover:bg-surface-hover"}`}>
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}

export function AudienceIntelligenceView({ mode, audienceId }: { mode: AudienceIntelligenceViewMode; audienceId?: string }) {
  const { preference } = useWorkspace();
  const brandId = preference.currentBrandId;
  const organisationId = preference.currentOrganisationId;
  const [audiences, setAudiences] = useState<Audience[]>([]);
  const [audience, setAudience] = useState<Audience | null>(null);
  const [eligibility, setEligibility] = useState<Record<string, unknown> | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState("PROSPECTING");
  const [retargetingDays, setRetargetingDays] = useState("30");
  const [ruleKey, setRuleKey] = useState("page_viewed");

  const apiBase = useMemo(() => (brandId ? `/api/brands/${brandId}/advertising/audiences` : null), [brandId]);

  const loadAudiences = useCallback(async () => {
    if (!apiBase || !organisationId) return;
    const data = await apiFetch<{ items: Audience[] }>(`${apiBase}?organisationId=${organisationId}`, { organisationId });
    setAudiences(data.items);
  }, [apiBase, organisationId]);

  const loadAudience = useCallback(async () => {
    if (!apiBase || !organisationId || !audienceId) return;
    const data = await apiFetch<{ audience: Audience }>(`${apiBase}/${audienceId}?organisationId=${organisationId}`, { organisationId });
    setAudience(data.audience);
  }, [apiBase, organisationId, audienceId]);

  useEffect(() => {
    void (async () => {
      try {
        if (mode === "list") await loadAudiences();
        if (audienceId && mode !== "list" && mode !== "new") await loadAudience();
      } catch { setMessage("Failed to load audience data."); }
    })();
  }, [mode, audienceId, loadAudiences, loadAudience]);

  async function postAction(action: string, payload: Record<string, unknown> = {}) {
    if (!apiBase || !organisationId || !audienceId) return;
    setLoading(true);
    try {
      const data = await apiFetch(`${apiBase}/${audienceId}?organisationId=${organisationId}`, {
        method: "POST", organisationId, body: JSON.stringify({ action, ...payload }),
      });
      if (action === "eligibility") setEligibility(data as Record<string, unknown>);
      await loadAudience();
      setMessage(`Action "${action}" completed.`);
    } catch { setMessage(`Action "${action}" failed.`); }
    finally { setLoading(false); }
  }

  async function createAudience() {
    if (!apiBase || !organisationId || !newName) return;
    setLoading(true);
    try {
      const data = await apiFetch<{ audience: Audience }>(`${apiBase}?organisationId=${organisationId}`, {
        method: "POST", organisationId,
        body: JSON.stringify({ name: newName, audienceType: newType, retargetingWindowDays: Number(retargetingDays) }),
      });
      window.location.href = `/advertising/audiences/${data.audience.id}`;
    } catch { setMessage("Failed to create audience."); setLoading(false); }
  }

  if (!brandId || !organisationId) {
    return <Card><CardContent className="py-8 text-center text-sm text-foreground-muted">Select a brand workspace.</CardContent></Card>;
  }

  if (mode === "list") {
    return (
      <div className="space-y-6">
        <PageHeader title="Audience Intelligence" description="Privacy-conscious audience planning without external activation."
          actions={<ButtonLink href="/advertising/audiences/new">New audience</ButtonLink>} />
        <Card><CardContent className="divide-y p-0">
          {audiences.length === 0 ? <p className="p-6 text-sm text-foreground-muted">No audiences yet.</p> :
            audiences.map((a) => (
              <Link key={a.id} href={`/advertising/audiences/${a.id}`} className="flex justify-between px-6 py-4 hover:bg-surface-subtle">
                <div><p className="font-medium">{a.name}</p><p className="text-xs text-foreground-subtle">{a.audienceType.replace(/_/g, " ")}</p></div>
                <Badge variant={STATUS_VARIANT[a.status] ?? "muted"}>{a.status}</Badge>
              </Link>
            ))}
        </CardContent></Card>
      </div>
    );
  }

  if (mode === "new") {
    return (
      <div className="space-y-6">
        <PageHeader title="New Audience" description="Design a consent-aware audience segment." />
        <Card><CardContent className="space-y-4 pt-6">
          <Input label="Audience name" value={newName} onChange={(e) => setNewName(e.target.value)} />
          <div>
            <label className="text-sm font-medium text-foreground-muted">Audience type</label>
            <select className="mt-1 w-full rounded-md border px-3 py-2 text-sm" value={newType} onChange={(e) => setNewType(e.target.value)}>
              {AUDIENCE_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-foreground-muted">Retargeting window (days)</label>
            <select className="mt-1 w-full rounded-md border px-3 py-2 text-sm" value={retargetingDays} onChange={(e) => setRetargetingDays(e.target.value)}>
              {RETARGETING_WINDOWS.map((d) => <option key={d} value={d}>{d} days</option>)}
            </select>
          </div>
          <Button onClick={() => void createAudience()} disabled={loading || !newName}>Create audience</Button>
        </CardContent></Card>
      </div>
    );
  }

  if (!audience) return <p className="text-sm text-foreground-muted">Loading…</p>;

  return (
    <div className="space-y-6">
      <PageHeader title={audience.name} description={audience.audienceType.replace(/_/g, " ")}
        actions={<Badge variant={STATUS_VARIANT[audience.status] ?? "muted"}>{audience.status}</Badge>} />
      {audienceId ? <AudienceNav audienceId={audienceId} active={mode} /> : null}
      {message ? <p className="text-sm text-foreground-muted">{message}</p> : null}

      {mode === "detail" && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card><CardHeader><CardTitle className="text-base">Summary</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>Retargeting: {audience.retargetingWindowDays ?? "—"} days</p>
              <p>Plan: {audience.campaignPlan?.name ?? "—"}</p>
              <p>Rules: {audience.rules?.length ?? 0} · Exclusions: {audience.exclusions?.length ?? 0}</p>
              {audience.estimates?.[0] ? (
                <p>Eligible: {audience.estimates[0].eligibleCount ?? "—"} · Consent-covered: {audience.estimates[0].consentCoveredCount ?? "—"}</p>
              ) : null}
            </CardContent>
          </Card>
          <Card><CardHeader><CardTitle className="text-base">Actions</CardTitle></CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" disabled={loading} onClick={() => void postAction("generate-plan")}>AI plan</Button>
              <Button size="sm" variant="outline" disabled={loading} onClick={() => void postAction("eligibility")}>Run eligibility</Button>
              <Button size="sm" variant="outline" disabled={loading} onClick={() => void postAction("submit-review")}>Submit review</Button>
              <Button size="sm" variant="outline" disabled={loading} onClick={() => void postAction("approve")}>Approve</Button>
            </CardContent>
          </Card>
        </div>
      )}

      {mode === "rules" && (
        <Card><CardHeader><CardTitle className="text-base">Audience rules</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <ul className="space-y-2 text-sm">
              {(audience.rules ?? []).map((r) => (
                <li key={r.id} className="rounded border px-3 py-2">{r.ruleKey} {r.operator}</li>
              ))}
            </ul>
            <div className="flex gap-2">
              <select className="rounded-md border px-3 py-2 text-sm" value={ruleKey} onChange={(e) => setRuleKey(e.target.value)}>
                <option value="page_viewed">Page viewed</option>
                <option value="form_submitted">Form submitted</option>
                <option value="lead_stage">Lead stage</option>
                <option value="geographic_country">Geographic country</option>
              </select>
              <Button size="sm" disabled={loading} onClick={() => void postAction("add-rule", { ruleKey, operator: "EQUALS", value: "true" })}>Add rule</Button>
            </div>
            <div className="border-t pt-4">
              <p className="mb-2 text-sm font-medium">Exclusions</p>
              <Button size="sm" variant="outline" disabled={loading}
                onClick={() => void postAction("add-exclusion", { exclusionType: "UNSUBSCRIBED_USERS" })}>Add unsubscribed exclusion</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {mode === "eligibility" && (
        <Card><CardHeader className="flex justify-between">
          <CardTitle className="text-base">Eligibility checks</CardTitle>
          <Button size="sm" variant="outline" disabled={loading} onClick={() => void postAction("eligibility")}>Re-run</Button>
        </CardHeader>
          <CardContent>
            {eligibility ? <p className="mb-4 text-sm">Overall: <Badge>{String(eligibility.overallStatus)}</Badge></p> : null}
            <ul className="space-y-2 text-sm">
              {(audience.eligibilityChecks ?? []).map((c) => (
                <li key={c.id} className="rounded border px-3 py-2">
                  <div className="flex justify-between"><span className="font-medium">{c.title}</span>
                    <Badge variant={c.status === "NOT_ELIGIBLE" ? "warning" : "muted"}>{c.status}</Badge></div>
                  <p className="text-foreground-subtle">{c.description}</p>
                </li>
              ))}
            </ul>
            {(audience.providerMappings ?? []).length > 0 && (
              <div className="mt-4 border-t pt-4">
                <p className="mb-2 text-sm font-medium">Provider mappings (not activated)</p>
                {audience.providerMappings!.map((m) => (
                  <p key={m.provider} className="text-sm">{m.provider}: {m.eligibilityStatus}</p>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {mode === "privacy" && (
        <Card><CardHeader><CardTitle className="text-base">Privacy & consent</CardTitle></CardHeader>
          <CardContent className="space-y-4 text-sm">
            <p>Marketing consent required. Deleted and suppressed identities excluded by default.</p>
            <p>No identities included without eligible consent basis.</p>
            <Button size="sm" variant="outline" disabled={loading}
              onClick={() => void postAction("update-consent", { marketingConsentRequired: true, deletionExcluded: true, customerListEligible: false })}>
              Apply default consent policy
            </Button>
          </CardContent>
        </Card>
      )}

      {mode === "history" && (
        <Card><CardHeader className="flex justify-between">
          <CardTitle className="text-base">Version history</CardTitle>
          <Button size="sm" variant="outline" disabled={loading} onClick={() => void postAction("create-version", { changeNote: "Manual snapshot" })}>Snapshot</Button>
        </CardHeader>
          <CardContent><ul className="space-y-2 text-sm">
            {(audience.versions ?? []).map((v) => (
              <li key={v.id} className="rounded border px-3 py-2">v{v.versionNumber}{v.changeNote ? ` — ${v.changeNote}` : ""}</li>
            ))}
          </ul></CardContent>
        </Card>
      )}
    </div>
  );
}
