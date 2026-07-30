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

export type CampaignPlanViewMode =
  | "overview"
  | "list"
  | "new"
  | "detail"
  | "strategy"
  | "audiences"
  | "budget"
  | "creatives"
  | "tracking"
  | "review"
  | "readiness";

type CampaignPlan = {
  id: string;
  name: string;
  description?: string | null;
  status: string;
  primaryObjective?: string | null;
  internalCampaignId: string;
  reportingCurrency: string;
  startAt?: string | null;
  endAt?: string | null;
  totalBudgetAmount?: number | null;
  channels?: Array<{ id: string; channelType: string; provider?: string | null }>;
  budgets?: Array<{ id: string; budgetType: string; currency: string; amount: number }>;
  audiences?: Array<{ id: string; name: string; audienceType: string; isExclusion?: boolean }>;
  destinations?: Array<{ id: string; destinationType: string; destinationUrl?: string | null }>;
  conversionGoals?: Array<{ id: string; isPrimary: boolean; trackingVerified: boolean }>;
  creatives?: Array<{ id: string; format: string; approvalStatus: string }>;
  approvals?: Array<{ id: string; approvalType: string; decision: string }>;
  readinessChecks?: Array<{ id: string; checkType: string; status: string; title: string; description: string }>;
  versions?: Array<{ id: string; versionNumber: number; createdAt: string }>;
  _count?: { channels: number; budgets: number; approvals: number; creatives: number };
};

const STATUS_VARIANT: Record<string, "default" | "muted" | "warning"> = {
  DRAFT: "muted",
  PLANNING: "default",
  READY_FOR_REVIEW: "warning",
  APPROVED: "default",
  CHANGES_REQUESTED: "warning",
};

const CHANNEL_OPTIONS = [
  "GOOGLE_SEARCH",
  "GOOGLE_DISPLAY",
  "META_FACEBOOK",
  "META_INSTAGRAM",
  "LINKEDIN",
  "TIKTOK",
];

const OBJECTIVE_OPTIONS = [
  "BRAND_AWARENESS",
  "LEAD_GENERATION",
  "WEBSITE_TRAFFIC",
  "PURCHASES",
  "VIDEO_VIEWS",
];

function PlanNav({ planId, active }: { planId: string; active: CampaignPlanViewMode }) {
  const tabs: Array<{ mode: CampaignPlanViewMode; label: string; href: string }> = [
    { mode: "detail", label: "Overview", href: `/advertising/plans/${planId}` },
    { mode: "strategy", label: "Strategy", href: `/advertising/plans/${planId}/strategy` },
    { mode: "audiences", label: "Audiences", href: `/advertising/plans/${planId}/audiences` },
    { mode: "budget", label: "Budget", href: `/advertising/plans/${planId}/budget` },
    { mode: "creatives", label: "Creatives", href: `/advertising/plans/${planId}/creatives` },
    { mode: "tracking", label: "Tracking", href: `/advertising/plans/${planId}/tracking` },
    { mode: "review", label: "Review", href: `/advertising/plans/${planId}/review` },
    { mode: "readiness", label: "Readiness", href: `/advertising/plans/${planId}/readiness` },
  ];

  return (
    <nav className="flex flex-wrap gap-2 border-b border-slate-200 pb-3" aria-label="Campaign plan sections">
      {tabs.map((tab) => (
        <Link
          key={tab.mode}
          href={tab.href}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            active === tab.mode
              ? "bg-slate-900 text-white"
              : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}

export function CampaignPlanView({ mode, planId }: { mode: CampaignPlanViewMode; planId?: string }) {
  const { preference } = useWorkspace();
  const brandId = preference.currentBrandId;
  const organisationId = preference.currentOrganisationId;

  const [plans, setPlans] = useState<CampaignPlan[]>([]);
  const [plan, setPlan] = useState<CampaignPlan | null>(null);
  const [readiness, setReadiness] = useState<{ checks: Array<Record<string, unknown>>; overallStatus: string } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newObjective, setNewObjective] = useState("LEAD_GENERATION");
  const [newCurrency, setNewCurrency] = useState("USD");
  const [channelType, setChannelType] = useState("GOOGLE_SEARCH");
  const [budgetAmount, setBudgetAmount] = useState("5000");
  const [audienceName, setAudienceName] = useState("");
  const [destinationUrl, setDestinationUrl] = useState("https://");

  const apiBase = useMemo(() => {
    if (!brandId) return null;
    return `/api/brands/${brandId}/advertising/plans`;
  }, [brandId]);

  const loadPlans = useCallback(async () => {
    if (!apiBase || !organisationId) return;
    const data = await apiFetch<{ items: CampaignPlan[] }>(`${apiBase}?organisationId=${organisationId}`, {
      organisationId,
    });
    setPlans(data.items);
  }, [apiBase, organisationId]);

  const loadPlan = useCallback(async () => {
    if (!apiBase || !organisationId || !planId) return;
    const data = await apiFetch<{ plan: CampaignPlan }>(`${apiBase}/${planId}?organisationId=${organisationId}`, {
      organisationId,
    });
    setPlan(data.plan);
  }, [apiBase, organisationId, planId]);

  const runReadiness = useCallback(async () => {
    if (!apiBase || !organisationId || !planId) return;
    const data = await apiFetch<{ checks: Array<Record<string, unknown>>; overallStatus: string }>(
      `${apiBase}/${planId}?organisationId=${organisationId}`,
      {
        method: "POST",
        organisationId,
        body: JSON.stringify({ action: "readiness" }),
      },
    );
    setReadiness(data);
    await loadPlan();
  }, [apiBase, organisationId, planId, loadPlan]);

  useEffect(() => {
    void (async () => {
      try {
        if (mode === "overview" || mode === "list") await loadPlans();
        if (planId && mode !== "overview" && mode !== "list" && mode !== "new") await loadPlan();
        if (mode === "readiness" && planId) await runReadiness();
      } catch {
        setMessage("Failed to load advertising plan data.");
      }
    })();
  }, [mode, planId, loadPlans, loadPlan, runReadiness]);

  async function postAction(action: string, payload: Record<string, unknown> = {}) {
    if (!apiBase || !organisationId || !planId) return;
    setLoading(true);
    setMessage(null);
    try {
      await apiFetch(`${apiBase}/${planId}?organisationId=${organisationId}`, {
        method: "POST",
        organisationId,
        body: JSON.stringify({ action, ...payload }),
      });
      await loadPlan();
      setMessage(`Action "${action}" completed.`);
    } catch {
      setMessage(`Action "${action}" failed.`);
    } finally {
      setLoading(false);
    }
  }

  async function createPlan() {
    if (!apiBase || !organisationId || !newName) return;
    setLoading(true);
    try {
      const data = await apiFetch<{ plan: CampaignPlan }>(`${apiBase}?organisationId=${organisationId}`, {
        method: "POST",
        organisationId,
        body: JSON.stringify({
          name: newName,
          description: newDescription || undefined,
          primaryObjective: newObjective,
          reportingCurrency: newCurrency,
        }),
      });
      window.location.href = `/advertising/plans/${data.plan.id}`;
    } catch {
      setMessage("Failed to create campaign plan.");
      setLoading(false);
    }
  }

  if (!brandId || !organisationId) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-slate-600">
          Select a brand workspace to manage advertising campaign plans.
        </CardContent>
      </Card>
    );
  }

  if (mode === "overview") {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Advertising"
          description="Plan campaigns before publishing to Google, Meta, LinkedIn, TikTok, or other providers."
        />
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Campaign Plans</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-slate-600">
                Create structured, provider-independent campaign plans with objectives, budgets, audiences, and creatives.
              </p>
              <ButtonLink href="/advertising/plans">View plans</ButtonLink>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">New Plan</CardTitle>
            </CardHeader>
            <CardContent>
              <ButtonLink href="/advertising/plans/new" variant="outline">
                Create campaign plan
              </ButtonLink>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Performance Data</CardTitle>
            </CardHeader>
            <CardContent>
              <ButtonLink href="/analytics/advertising" variant="outline">
                View imported campaigns
              </ButtonLink>
            </CardContent>
          </Card>
        </div>
        {plans.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recent plans</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {plans.slice(0, 5).map((p) => (
                <Link
                  key={p.id}
                  href={`/advertising/plans/${p.id}`}
                  className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3 hover:bg-slate-50"
                >
                  <span className="font-medium text-slate-900">{p.name}</span>
                  <Badge variant={STATUS_VARIANT[p.status] ?? "secondary"}>{p.status}</Badge>
                </Link>
              ))}
            </CardContent>
          </Card>
        ) : null}
      </div>
    );
  }

  if (mode === "list") {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Campaign Plans"
          description="Provider-independent advertising campaign plans."
          actions={
            <ButtonLink href="/advertising/plans/new">New plan</ButtonLink>
          }
        />
        {message ? <p className="text-sm text-red-600">{message}</p> : null}
        <Card>
          <CardContent className="divide-y divide-slate-100 p-0">
            {plans.length === 0 ? (
              <p className="p-6 text-sm text-slate-600">No campaign plans yet.</p>
            ) : (
              plans.map((p) => (
                <Link
                  key={p.id}
                  href={`/advertising/plans/${p.id}`}
                  className="flex items-center justify-between px-6 py-4 hover:bg-slate-50"
                >
                  <div>
                    <p className="font-medium text-slate-900">{p.name}</p>
                    <p className="text-xs text-slate-500">{p.internalCampaignId}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-500">
                      {p._count?.channels ?? 0} channels · {p._count?.budgets ?? 0} budgets
                    </span>
                    <Badge variant={STATUS_VARIANT[p.status] ?? "secondary"}>{p.status}</Badge>
                  </div>
                </Link>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (mode === "new") {
    return (
      <div className="space-y-6">
        <PageHeader title="New Campaign Plan" description="Start a provider-independent campaign plan." />
        {message ? <p className="text-sm text-red-600">{message}</p> : null}
        <Card>
          <CardContent className="space-y-4 pt-6">
            <div>
              <Input label="Plan name" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Q1 Lead Gen Campaign" />
            </div>
            <div>
              <Input label="Description" value={newDescription} onChange={(e) => setNewDescription(e.target.value)} placeholder="Optional" />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-sm font-medium text-slate-700">Primary objective</label>
                <select
                  className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                  value={newObjective}
                  onChange={(e) => setNewObjective(e.target.value)}
                >
                  {OBJECTIVE_OPTIONS.map((o) => (
                    <option key={o} value={o}>
                      {o.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Input label="Reporting currency" value={newCurrency} onChange={(e) => setNewCurrency(e.target.value.toUpperCase())} maxLength={3} />
              </div>
            </div>
            <Button onClick={() => void createPlan()} disabled={loading || !newName}>
              Create plan
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!plan) {
    return <p className="text-sm text-slate-600">Loading campaign plan…</p>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={plan.name}
        description={plan.internalCampaignId}
        actions={
          <Badge variant={STATUS_VARIANT[plan.status] ?? "secondary"}>{plan.status}</Badge>
        }
      />
      {planId ? <PlanNav planId={planId} active={mode} /> : null}
      {message ? <p className="text-sm text-slate-600">{message}</p> : null}

      {mode === "detail" ? (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Plan summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>
                <span className="text-slate-500">Objective:</span> {plan.primaryObjective ?? "Not set"}
              </p>
              <p>
                <span className="text-slate-500">Currency:</span> {plan.reportingCurrency}
              </p>
              <p>
                <span className="text-slate-500">Channels:</span> {plan.channels?.length ?? 0}
              </p>
              <p>
                <span className="text-slate-500">Budgets:</span> {plan.budgets?.length ?? 0}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Quick actions</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" disabled={loading} onClick={() => void postAction("generate")}>
                AI propose plan
              </Button>
              <Button size="sm" variant="outline" disabled={loading} onClick={() => void postAction("submit-review")}>
                Submit for review
              </Button>
              <Button size="sm" variant="outline" disabled={loading} onClick={() => void runReadiness()}>
                Run readiness
              </Button>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {mode === "strategy" ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Channels</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="space-y-2 text-sm">
              {(plan.channels ?? []).map((ch) => (
                <li key={ch.id} className="flex justify-between rounded border border-slate-200 px-3 py-2">
                  <span>{ch.channelType}</span>
                  <span className="text-slate-500">{ch.provider ?? "—"}</span>
                </li>
              ))}
            </ul>
            <div className="flex gap-2">
              <select
                className="rounded-md border border-slate-200 px-3 py-2 text-sm"
                value={channelType}
                onChange={(e) => setChannelType(e.target.value)}
              >
                {CHANNEL_OPTIONS.map((c) => (
                  <option key={c} value={c}>
                    {c.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
              <Button
                size="sm"
                disabled={loading}
                onClick={() => void postAction("add-channel", { channelType })}
              >
                Add channel
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {mode === "audiences" ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Audience plans</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="space-y-2 text-sm">
              {(plan.audiences ?? []).map((a) => (
                <li key={a.id} className="rounded border border-slate-200 px-3 py-2">
                  {a.name} <span className="text-slate-500">({a.audienceType})</span>
                </li>
              ))}
            </ul>
            <div className="flex gap-2">
              <Input
                label="Audience name"
                value={audienceName}
                onChange={(e) => setAudienceName(e.target.value)}
                placeholder="Audience name"
              />
              <Button
                size="sm"
                disabled={loading || !audienceName}
                onClick={() =>
                  void postAction("add-audience", {
                    audienceType: "BROAD",
                    name: audienceName,
                  }).then(() => setAudienceName(""))
                }
              >
                Add audience
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {mode === "budget" ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Budget planning</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="space-y-2 text-sm">
              {(plan.budgets ?? []).map((b) => (
                <li key={b.id} className="flex justify-between rounded border border-slate-200 px-3 py-2">
                  <span>{b.budgetType}</span>
                  <span>
                    {b.currency} {Number(b.amount).toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
            <div className="flex gap-2">
              <Input
                label="Budget amount"
                type="number"
                value={budgetAmount}
                onChange={(e) => setBudgetAmount(e.target.value)}
                placeholder="Amount"
              />
              <Button
                size="sm"
                disabled={loading}
                onClick={() =>
                  void postAction("add-budget", {
                    budgetType: "LIFETIME",
                    currency: plan.reportingCurrency,
                    amount: Number(budgetAmount),
                  })
                }
              >
                Add budget
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {mode === "creatives" ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Creative plans</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {(plan.creatives ?? []).map((c) => (
                <li key={c.id} className="flex justify-between rounded border border-slate-200 px-3 py-2">
                  <span>{c.format}</span>
                  <Badge variant={c.approvalStatus === "APPROVED" ? "default" : "muted"}>
                    {c.approvalStatus}
                  </Badge>
                </li>
              ))}
              {(plan.creatives ?? []).length === 0 ? (
                <p className="text-slate-500">Attach approved brand assets from the Asset Library via API.</p>
              ) : null}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      {mode === "tracking" ? (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Destinations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-2 text-sm">
                {(plan.destinations ?? []).map((d) => (
                  <li key={d.id} className="rounded border border-slate-200 px-3 py-2">
                    {d.destinationType}: {d.destinationUrl ?? "—"}
                  </li>
                ))}
              </ul>
              <div className="flex gap-2">
                <Input
                  label="Destination URL"
                  value={destinationUrl}
                  onChange={(e) => setDestinationUrl(e.target.value)}
                  placeholder="https://example.com/landing"
                />
                <Button
                  size="sm"
                  disabled={loading}
                  onClick={() =>
                    void postAction("add-destination", {
                      destinationType: "LANDING_PAGE",
                      destinationUrl,
                      utmTemplate: "utm_source=ads&utm_medium={channel}&utm_campaign={campaign}",
                    })
                  }
                >
                  Add destination
                </Button>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Conversion goals</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-2 text-sm">
                {(plan.conversionGoals ?? []).map((g) => (
                  <li key={g.id} className="rounded border border-slate-200 px-3 py-2">
                    {g.isPrimary ? "Primary" : "Secondary"} — tracking{" "}
                    {g.trackingVerified ? "verified" : "unverified"}
                  </li>
                ))}
              </ul>
              <Button
                size="sm"
                disabled={loading}
                onClick={() => void postAction("add-conversion", { isPrimary: true })}
              >
                Add primary conversion
              </Button>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {mode === "review" ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Approvals</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-slate-600">
              Separate approvals are required for strategy, budget, audience, creative, compliance, and launch.
            </p>
            <ul className="space-y-2 text-sm">
              {(plan.approvals ?? []).map((a) => (
                <li key={a.id} className="flex justify-between rounded border border-slate-200 px-3 py-2">
                  <span>{a.approvalType}</span>
                  <Badge variant={a.decision === "APPROVED" ? "default" : "muted"}>{a.decision}</Badge>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-2">
              {["STRATEGY", "BUDGET", "AUDIENCE", "CREATIVE", "COMPLIANCE", "LAUNCH"].map((type) => (
                <Button
                  key={type}
                  size="sm"
                  variant="outline"
                  disabled={loading}
                  onClick={() => void postAction("request-approval", { approvalType: type })}
                >
                  Request {type.toLowerCase()}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {mode === "readiness" ? (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Readiness checks</CardTitle>
            <Button size="sm" variant="outline" disabled={loading} onClick={() => void runReadiness()}>
              Re-run checks
            </Button>
          </CardHeader>
          <CardContent>
            {readiness ? (
              <p className="mb-4 text-sm font-medium">
                Overall: <Badge>{readiness.overallStatus}</Badge>
              </p>
            ) : null}
            <ul className="space-y-2 text-sm">
              {(plan.readinessChecks ?? []).map((c) => (
                <li key={c.id} className="rounded border border-slate-200 px-3 py-2">
                  <div className="flex justify-between">
                    <span className="font-medium">{c.title}</span>
                    <Badge variant={c.status === "NOT_READY" ? "warning" : "muted"}>{c.status}</Badge>
                  </div>
                  <p className="mt-1 text-slate-500">{c.description}</p>
                </li>
              ))}
              {(plan.readinessChecks ?? []).length === 0 ? (
                <p className="text-slate-500">Run readiness checks to validate the plan.</p>
              ) : null}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
