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
import { SPEND_INCREASE_DISCLAIMER } from "@/lib/advertising-budget-governance/constants";

export type BudgetGovernanceViewMode =
  | "overview"
  | "pacing"
  | "alerts"
  | "requests"
  | "policies"
  | "incidents";

function BudgetNav({ active }: { active: BudgetGovernanceViewMode }) {
  const tabs: Array<{ mode: BudgetGovernanceViewMode; label: string; href: string }> = [
    { mode: "overview", label: "Overview", href: "/advertising/budgets" },
    { mode: "pacing", label: "Pacing", href: "/advertising/budgets/pacing" },
    { mode: "alerts", label: "Alerts", href: "/advertising/budgets/alerts" },
    { mode: "requests", label: "Requests", href: "/advertising/budgets/requests" },
    { mode: "policies", label: "Policies", href: "/advertising/budgets/policies" },
    { mode: "incidents", label: "Incidents", href: "/advertising/budgets/incidents" },
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

const SEVERITY_VARIANT: Record<string, "default" | "muted" | "warning"> = {
  INFO: "muted",
  WARNING: "warning",
  CRITICAL: "default",
};

export function BudgetGovernanceView({ mode }: { mode: BudgetGovernanceViewMode }) {
  const { preference } = useWorkspace();
  const brandId = preference.currentBrandId;
  const organisationId = preference.currentOrganisationId;
  const base = brandId ? `/api/brands/${brandId}/advertising/budgets` : null;

  const [dashboard, setDashboard] = useState<Record<string, unknown> | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [policyName, setPolicyName] = useState("Default governance policy");
  const [requestReason, setRequestReason] = useState("");
  const [currentBudget, setCurrentBudget] = useState("1000");
  const [proposedBudget, setProposedBudget] = useState("1100");
  const [emergencyReason, setEmergencyReason] = useState("");
  const [pacingBudget, setPacingBudget] = useState("5000");
  const [pacingSpend, setPacingSpend] = useState("2000");

  const loadDashboard = useCallback(async () => {
    if (!base || !organisationId) return;
    setLoading(true);
    try {
      const res = await apiFetch<{ dashboard: Record<string, unknown> }>(`${base}?organisationId=${organisationId}`);
      setDashboard(res.dashboard);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Failed to load budget dashboard.");
    } finally {
      setLoading(false);
    }
  }, [base, organisationId]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  async function postAction(body: Record<string, unknown>, resourceId?: string) {
    if (!base || !organisationId) return;
    setLoading(true);
    setMessage(null);
    try {
      const url = resourceId ? `${base}/${resourceId}?organisationId=${organisationId}` : `${base}?organisationId=${organisationId}`;
      await apiFetch(url, { method: "POST", body: JSON.stringify(body) });
      setMessage("Action completed.");
      await loadDashboard();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Action failed.");
    } finally {
      setLoading(false);
    }
  }

  const policies = (dashboard?.policies as Array<Record<string, unknown>>) ?? [];
  const alerts = (dashboard?.alerts as Array<Record<string, unknown>>) ?? [];
  const requests = (dashboard?.changeRequests as Array<Record<string, unknown>>) ?? [];
  const incidents = (dashboard?.incidents as Array<Record<string, unknown>>) ?? [];
  const snapshots = (dashboard?.pacingSnapshots as Array<Record<string, unknown>>) ?? [];
  const allocations = (dashboard?.allocations as Array<Record<string, unknown>>) ?? [];
  const mutationAllowed = dashboard?.mutationAllowed as { allowed: boolean; blockers: string[] } | undefined;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Advertising Budget Governance"
        description="Monitor spend, pacing, alerts, and human-approved budget changes. Spend is never increased autonomously."
      />
      <BudgetNav active={mode} />
      {message && <p className="text-sm text-muted-foreground">{message}</p>}
      {loading && <p className="text-sm text-muted-foreground">Loading…</p>}

      {mutationAllowed && !mutationAllowed.allowed && (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Emergency controls active</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc pl-5 text-sm">
              {mutationAllowed.blockers.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {(mode === "overview" || mode === "pacing") && (
        <>
          {mode === "pacing" && (
            <Card>
              <CardHeader>
                <CardTitle>Compute pacing</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Input label="Total budget" value={pacingBudget} onChange={(e) => setPacingBudget(e.target.value)} />
                <Input label="Actual spend" value={pacingSpend} onChange={(e) => setPacingSpend(e.target.value)} />
                <Button
                  disabled={loading}
                  onClick={() =>
                    postAction({
                      action: "computePacing",
                      totalBudget: Number(pacingBudget),
                      actualSpend: Number(pacingSpend),
                      currency: "USD",
                      periodStart: new Date(Date.now() - 15 * 86400000).toISOString(),
                      periodEnd: new Date(Date.now() + 15 * 86400000).toISOString(),
                    })
                  }
                >
                  Compute pacing snapshot
                </Button>
              </CardContent>
            </Card>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Allocations</CardTitle>
              </CardHeader>
              <CardContent>
                {allocations.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No allocations yet.</p>
                ) : (
                  <ul className="space-y-2 text-sm">
                    {allocations.slice(0, 5).map((a) => (
                      <li key={String(a.id)} className="flex justify-between">
                        <span>{String(a.provider ?? a.scopeType)}</span>
                        <span>
                          {String(a.spentAmount)} / {String(a.allocatedAmount)} {String(a.currency)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recent pacing snapshots</CardTitle>
              </CardHeader>
              <CardContent>
                {snapshots.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No pacing snapshots yet.</p>
                ) : (
                  <ul className="space-y-2 text-sm">
                    {snapshots.slice(0, 5).map((s) => (
                      <li key={String(s.id)} className="flex justify-between gap-2">
                        <span>
                          {String(s.actualSpend)} / {String(s.totalBudget)} {String(s.currency)}
                        </span>
                        <span className="flex gap-1">
                          {s.overspendRisk ? <Badge variant="warning">Overspend</Badge> : null}
                          {s.underspendRisk ? <Badge variant="muted">Underspend</Badge> : null}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {mode === "alerts" && (
        <Card>
          <CardHeader>
            <CardTitle>Budget alerts</CardTitle>
          </CardHeader>
          <CardContent>
            {alerts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No active alerts.</p>
            ) : (
              <ul className="space-y-3">
                {alerts.map((alert) => (
                  <li key={String(alert.id)} className="flex items-start justify-between gap-4 border-b pb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge variant={SEVERITY_VARIANT[String(alert.severity)] ?? "muted"}>{String(alert.severity)}</Badge>
                        <span className="font-medium text-sm">{String(alert.alertType)}</span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{String(alert.message)}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={loading}
                      onClick={() => postAction({ action: "acknowledgeAlert" }, String(alert.id))}
                    >
                      Acknowledge
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      {mode === "requests" && (
        <>
          <p className="text-sm text-muted-foreground">{SPEND_INCREASE_DISCLAIMER}</p>
          <Card>
            <CardHeader>
              <CardTitle>Submit change request</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input label="Reason" value={requestReason} onChange={(e) => setRequestReason(e.target.value)} />
              <Input label="Current budget" value={currentBudget} onChange={(e) => setCurrentBudget(e.target.value)} />
              <Input label="Proposed budget" value={proposedBudget} onChange={(e) => setProposedBudget(e.target.value)} />
              <Button
                disabled={loading || !requestReason}
                onClick={() =>
                  postAction({
                    action: "createChangeRequest",
                    requestType: Number(proposedBudget) > Number(currentBudget) ? "INCREASE_BUDGET" : "DECREASE_BUDGET",
                    reason: requestReason,
                    currency: "USD",
                    currentBudget: Number(currentBudget),
                    proposedBudget: Number(proposedBudget),
                    evidence: "Manual request from budget governance UI",
                    projectedImpact: "Pending approval",
                    risk: "Requires human review",
                  })
                }
              >
                Submit request
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Change requests</CardTitle>
            </CardHeader>
            <CardContent>
              {requests.length === 0 ? (
                <p className="text-sm text-muted-foreground">No change requests.</p>
              ) : (
                <ul className="space-y-3">
                  {requests.map((req) => (
                    <li key={String(req.id)} className="border-b pb-3">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm">{String(req.requestType)}</span>
                        <Badge variant={req.status === "PENDING" ? "warning" : "muted"}>{String(req.status)}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{String(req.reason)}</p>
                      <p className="text-sm mt-1">
                        {String(req.currentBudget)} → {String(req.proposedBudget)} {String(req.currency)} (
                        {String(req.percentageChange)}%)
                      </p>
                      {req.status === "PENDING" && (
                        <div className="flex gap-2 mt-2">
                          <Button size="sm" disabled={loading} onClick={() => postAction({ action: "approveChangeRequest" }, String(req.id))}>
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={loading}
                            onClick={() => postAction({ action: "rejectChangeRequest", notes: "Rejected from UI" }, String(req.id))}
                          >
                            Reject
                          </Button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {mode === "policies" && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Create policy</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input label="Policy name" value={policyName} onChange={(e) => setPolicyName(e.target.value)} />
              <Button disabled={loading} onClick={() => postAction({ action: "createPolicy", name: policyName })}>
                Create policy
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Active policies</CardTitle>
            </CardHeader>
            <CardContent>
              {policies.length === 0 ? (
                <p className="text-sm text-muted-foreground">No policies configured.</p>
              ) : (
                <ul className="space-y-3 text-sm">
                  {policies.map((p) => (
                    <li key={String(p.id)} className="border-b pb-3">
                      <div className="font-medium">{String(p.name)}</div>
                      <p className="text-muted-foreground">
                        Admin ≤{String(p.adminApprovalThresholdPct)}% · Owner ≤{String(p.ownerApprovalThresholdPct)}% · Hard
                        limit {String(p.hardLimitPct)}%
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {mode === "incidents" && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Trigger emergency control</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input label="Reason" value={emergencyReason} onChange={(e) => setEmergencyReason(e.target.value)} />
              <Button
                disabled={loading || !emergencyReason}
                onClick={() =>
                  postAction(
                    { action: "triggerEmergency", incidentType: "EMERGENCY_PAUSE", reason: emergencyReason },
                    "emergency",
                  )
                }
              >
                Emergency pause
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Active incidents</CardTitle>
            </CardHeader>
            <CardContent>
              {incidents.length === 0 ? (
                <p className="text-sm text-muted-foreground">No active incidents.</p>
              ) : (
                <ul className="space-y-3">
                  {incidents.map((inc) => (
                    <li key={String(inc.id)} className="border-b pb-3">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm">{String(inc.incidentType)}</span>
                        <Badge variant="warning">{String(inc.status)}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{String(inc.reason)}</p>
                      <Button
                        size="sm"
                        className="mt-2"
                        disabled={loading}
                        onClick={() => postAction({ action: "resolveIncident", restorationApproved: true }, String(inc.id))}
                      >
                        Resolve with approval
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {mode === "overview" && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Open alerts</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{alerts.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Pending requests</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{requests.filter((r) => r.status === "PENDING").length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Active incidents</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{incidents.length}</p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
