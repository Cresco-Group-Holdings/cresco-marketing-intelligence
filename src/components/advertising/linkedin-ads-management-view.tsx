"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { apiFetch } from "@/lib/api/client";
import { LINKEDIN_ADS_CAPABILITIES } from "@/lib/advertising-providers/capability-gates";

export type LinkedInAdsManagementViewMode = "overview" | "drafts" | "launches";

function LinkedInNav({ active }: { active: LinkedInAdsManagementViewMode }) {
  const tabs = [
    { mode: "overview" as const, label: "Overview", href: "/advertising/linkedin" },
    { mode: "drafts" as const, label: "Drafts", href: "/advertising/linkedin/drafts" },
    { mode: "launches" as const, label: "Launches", href: "/advertising/linkedin/launches" },
  ];
  return (
    <nav className="flex flex-wrap gap-2 border-b pb-3 mb-6">
      {tabs.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          className={`rounded-md px-3 py-1.5 text-sm ${active === tab.mode ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}

export function LinkedInAdsManagementView({ mode }: { mode: LinkedInAdsManagementViewMode }) {
  const { preference } = useWorkspace();
  const brandId = preference.currentBrandId;
  const organisationId = preference.currentOrganisationId;
  const base = brandId ? `/api/brands/${brandId}/advertising/linkedin` : null;

  const [status, setStatus] = useState<Record<string, unknown> | null>(null);
  const [drafts, setDrafts] = useState<Array<Record<string, unknown>>>([]);
  const [launches, setLaunches] = useState<Array<Record<string, unknown>>>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [linkedInAccountId, setLinkedInAccountId] = useState("");
  const [planId, setPlanId] = useState("");

  const loadStatus = useCallback(async () => {
    if (!base || !organisationId) return;
    const res = await apiFetch<{ status: Record<string, unknown> }>(`${base}/accounts?organisationId=${organisationId}`);
    setStatus(res.status);
  }, [base, organisationId]);

  const loadDrafts = useCallback(async () => {
    if (!base || !organisationId) return;
    const res = await apiFetch<{ drafts: Array<Record<string, unknown>> }>(`${base}/drafts?organisationId=${organisationId}`);
    setDrafts(res.drafts);
  }, [base, organisationId]);

  const loadLaunches = useCallback(async () => {
    if (!base || !organisationId) return;
    const res = await apiFetch<{ launches: Array<Record<string, unknown>> }>(`${base}/launches?organisationId=${organisationId}`);
    setLaunches(res.launches);
  }, [base, organisationId]);

  useEffect(() => {
    if (mode === "overview") loadStatus();
    if (mode === "drafts") loadDrafts();
    if (mode === "launches") loadLaunches();
  }, [mode, loadStatus, loadDrafts, loadLaunches]);

  const assignAccount = async () => {
    if (!base || !organisationId || !linkedInAccountId) return;
    setLoading(true);
    setMessage(null);
    try {
      await apiFetch(`${base}/accounts?organisationId=${organisationId}`, {
        method: "POST",
        body: JSON.stringify({ action: "assign", linkedInAccountId }),
      });
      setMessage("LinkedIn ad account assigned.");
      await loadStatus();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Failed to assign account.");
    } finally {
      setLoading(false);
    }
  };

  const createDraft = async () => {
    if (!base || !organisationId || !planId) return;
    setLoading(true);
    setMessage(null);
    try {
      await apiFetch(`${base}/drafts?organisationId=${organisationId}`, {
        method: "POST",
        body: JSON.stringify({ action: "create-from-plan", planId }),
      });
      setMessage("Draft created from plan.");
      await loadDrafts();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Failed to create draft.");
    } finally {
      setLoading(false);
    }
  };

  const disabledCaps = LINKEDIN_ADS_CAPABILITIES.filter((c) => !c.available);

  return (
    <div>
      <PageHeader title="LinkedIn Ads" description="Controlled LinkedIn campaign management with capability gates and exact-plan approval." />
      <LinkedInNav active={mode} />
      {message && <p className="mb-4 text-sm text-muted-foreground">{message}</p>}

      {mode === "overview" && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Account status</CardTitle></CardHeader>
            <CardContent>
              <p className="text-sm">Connection: {(status?.connection as Record<string, unknown>)?.status as string ?? "—"}</p>
              <p className="text-sm">Assigned: {(status?.assigned as Record<string, unknown>)?.status as string ?? "None"}</p>
              <div className="mt-4 flex gap-2">
                <Input label="LinkedIn ad account ID" placeholder="LinkedIn ad account ID" value={linkedInAccountId} onChange={(e) => setLinkedInAccountId(e.target.value)} />
                <Button onClick={assignAccount} disabled={loading}>Assign</Button>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Capability gates</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {disabledCaps.map((c) => (
                <div key={c.id} className="flex items-center gap-2 text-sm">
                  <Badge variant="muted">Disabled</Badge>
                  <span>{c.label}</span>
                  {c.reason && <span className="text-muted-foreground">— {c.reason}</span>}
                </div>
              ))}
              {disabledCaps.length === 0 && <p className="text-sm text-muted-foreground">All audited capabilities enabled.</p>}
            </CardContent>
          </Card>
          <Card className="md:col-span-2">
            <CardHeader><CardTitle>Create draft</CardTitle></CardHeader>
            <CardContent className="flex gap-2">
              <Input label="Approved plan ID" placeholder="Approved plan ID" value={planId} onChange={(e) => setPlanId(e.target.value)} />
              <Button onClick={createDraft} disabled={loading}>Create draft</Button>
            </CardContent>
          </Card>
        </div>
      )}

      {mode === "drafts" && (
        <Card>
          <CardHeader><CardTitle>Provider drafts</CardTitle></CardHeader>
          <CardContent>
            {drafts.length === 0 ? <p className="text-sm text-muted-foreground">No drafts yet.</p> : (
              <ul className="space-y-2">
                {drafts.map((d) => (
                  <li key={d.id as string} className="flex items-center justify-between border-b pb-2 text-sm">
                    <span>{(d.plan as Record<string, unknown>)?.name as string ?? d.id as string}</span>
                    <Badge variant={d.status === "VALIDATED" ? "default" : "muted"}>{d.status as string}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      {mode === "launches" && (
        <Card>
          <CardHeader><CardTitle>Launches</CardTitle></CardHeader>
          <CardContent>
            {launches.length === 0 ? <p className="text-sm text-muted-foreground">No launches yet.</p> : (
              <ul className="space-y-2">
                {launches.map((l) => (
                  <li key={l.id as string} className="flex items-center justify-between border-b pb-2 text-sm">
                    <span>{(l.plan as Record<string, unknown>)?.name as string ?? l.id as string}</span>
                    <Badge variant={l.status === "LAUNCHED" ? "default" : "warning"}>{l.status as string}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
