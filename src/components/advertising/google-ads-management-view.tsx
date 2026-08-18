"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button, ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AdvertisingSectionNav } from "@/components/advertising/advertising-section-nav";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { apiFetch } from "@/lib/api/client";

export type GoogleAdsManagementViewMode =
  | "overview"
  | "accounts"
  | "drafts"
  | "launches"
  | "campaign-detail"
  | "operations";

type AccountStatus = {
  connection: { connected: boolean; accountSelected: boolean; account: Record<string, unknown> | null };
  assigned: {
    id: string;
    customerId: string;
    customerName?: string | null;
    currency?: string | null;
    timezone?: string | null;
    accessLevel?: string | null;
    isTestAccount: boolean;
    status: string;
  } | null;
};

type Draft = {
  id: string;
  status: string;
  campaignType: string;
  validationStatus: string;
  plan?: { id: string; name: string; status: string };
  mutationPlans?: Array<{ id: string; planHash: string; risks: string[] }>;
};

type Launch = {
  id: string;
  status: string;
  planHash: string;
  launchedAt?: string | null;
  plan?: { id: string; name: string };
  providerResources?: Array<{ resourceType: string; providerResourceName?: string | null }>;
};

type Operation = {
  id: string;
  operationType: string;
  status: string;
  reason: string;
  createdAt: string;
};

const STATUS_VARIANT: Record<string, "default" | "muted" | "warning"> = {
  DRAFT: "muted",
  VALIDATED: "default",
  PENDING_APPROVAL: "warning",
  APPROVED: "default",
  LAUNCHING: "warning",
  LAUNCHED: "default",
  FAILED: "warning",
  PARTIAL_SUCCESS: "warning",
};

function GoogleNav({ active, campaignId }: { active: GoogleAdsManagementViewMode; campaignId?: string }) {
  const tabs: Array<{ mode: GoogleAdsManagementViewMode; label: string; href: string }> = [
    { mode: "overview" as const, label: "Overview", href: "/advertising/google" },
    { mode: "accounts" as const, label: "Accounts", href: "/advertising/google/accounts" },
    { mode: "drafts" as const, label: "Drafts", href: "/advertising/google/drafts" },
    { mode: "launches" as const, label: "Launches", href: "/advertising/google/launches" },
    { mode: "operations" as const, label: "Operations", href: "/advertising/google/operations" },
  ];
  if (campaignId) {
    tabs.push({
      mode: "campaign-detail",
      label: "Campaign",
      href: `/advertising/google/campaigns/${campaignId}`,
    });
  }
  return (
    <AdvertisingSectionNav
      ariaLabel="Google Ads navigation"
      tabs={tabs.map((tab) => ({
        label: tab.label,
        href: tab.href,
        active: active === tab.mode,
      }))}
    />
  );
}

export function GoogleAdsManagementView({
  mode,
  campaignId,
}: {
  mode: GoogleAdsManagementViewMode;
  campaignId?: string;
}) {
  const { preference } = useWorkspace();
  const brandId = preference.currentBrandId;
  const organisationId = preference.currentOrganisationId;
  const [accountStatus, setAccountStatus] = useState<AccountStatus | null>(null);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [launches, setLaunches] = useState<Launch[]>([]);
  const [operations, setOperations] = useState<Operation[]>([]);
  const [launchDetail, setLaunchDetail] = useState<Launch | null>(null);
  const [customerId, setCustomerId] = useState("");
  const [managerId, setManagerId] = useState("");
  const [planId, setPlanId] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const base = `/api/brands/${brandId}/advertising/google`;

  const loadAccount = useCallback(async () => {
    if (!brandId || !organisationId) return;
    const res = await apiFetch<{ status: AccountStatus }>(`${base}/accounts?organisationId=${organisationId}`);
    setAccountStatus(res.status);
  }, [base, brandId, organisationId]);

  const loadDrafts = useCallback(async () => {
    if (!brandId || !organisationId) return;
    const res = await apiFetch<{ drafts: Draft[] }>(`${base}/drafts?organisationId=${organisationId}`);
    setDrafts(res.drafts);
  }, [base, brandId, organisationId]);

  const loadLaunches = useCallback(async () => {
    if (!brandId || !organisationId) return;
    const res = await apiFetch<{ launches: Launch[] }>(`${base}/launches?organisationId=${organisationId}`);
    setLaunches(res.launches);
  }, [base, brandId, organisationId]);

  const loadOperations = useCallback(async () => {
    if (!brandId || !organisationId) return;
    const res = await apiFetch<{ operations: Operation[] }>(`${base}/operations?organisationId=${organisationId}`);
    setOperations(res.operations);
  }, [base, brandId, organisationId]);

  const loadCampaign = useCallback(async () => {
    if (!brandId || !organisationId || !campaignId) return;
    const res = await apiFetch<{ launch: Launch }>(
      `${base}/campaigns/${campaignId}?organisationId=${organisationId}`,
    );
    setLaunchDetail(res.launch);
  }, [base, brandId, organisationId, campaignId]);

  useEffect(() => {
    void loadAccount();
    if (mode === "drafts" || mode === "overview") void loadDrafts();
    if (mode === "launches" || mode === "overview") void loadLaunches();
    if (mode === "operations") void loadOperations();
    if (mode === "campaign-detail") void loadCampaign();
  }, [mode, loadAccount, loadDrafts, loadLaunches, loadOperations, loadCampaign]);

  async function assignAccount() {
    if (!customerId) return;
    setLoading(true);
    setMessage(null);
    try {
      await apiFetch(`${base}/accounts?organisationId=${organisationId}`, {
        method: "POST",
        body: JSON.stringify({ action: "assign", customerId, managerCustomerId: managerId || undefined }),
      });
      setMessage("Google Ads account assigned.");
      await loadAccount();
    } finally {
      setLoading(false);
    }
  }

  async function createDraft() {
    if (!planId) return;
    setLoading(true);
    setMessage(null);
    try {
      await apiFetch(`${base}/drafts?organisationId=${organisationId}`, {
        method: "POST",
        body: JSON.stringify({ action: "create-from-plan", planId }),
      });
      setMessage("Provider draft created (no mutations sent).");
      await loadDrafts();
    } finally {
      setLoading(false);
    }
  }

  async function buildMutationPlan(draftId: string) {
    setLoading(true);
    try {
      const res = await apiFetch<{ planHash: string }>(`${base}/drafts/${draftId}?organisationId=${organisationId}`, {
        method: "POST",
        body: JSON.stringify({ action: "build-mutation-plan" }),
      });
      setMessage(`Mutation plan created. Hash: ${res.planHash?.slice(0, 12)}…`);
      await loadDrafts();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Google Ads Management"
        description="Controlled campaign creation with audited mutation plans and explicit approvals."
      />
      <GoogleNav active={mode} campaignId={campaignId} />
      {message ? <p className="text-sm text-foreground-muted">{message}</p> : null}

      {mode === "overview" && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Account</CardTitle></CardHeader>
            <CardContent>
              {accountStatus?.assigned ? (
                <div className="space-y-1 text-sm">
                  <p>Customer: {accountStatus.assigned.customerName ?? accountStatus.assigned.customerId}</p>
                  <p>Currency: {accountStatus.assigned.currency ?? "—"}</p>
                  <p>Timezone: {accountStatus.assigned.timezone ?? "—"}</p>
                  <Badge variant={accountStatus.assigned.isTestAccount ? "warning" : "default"}>
                    {accountStatus.assigned.isTestAccount ? "Test account" : "Production"}
                  </Badge>
                </div>
              ) : (
                <p className="text-sm text-foreground-muted">No Google Ads account assigned to this brand.</p>
              )}
              <ButtonLink href="/advertising/google/accounts" className="mt-4">Manage accounts</ButtonLink>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Pipeline</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>{drafts.length} provider draft(s)</p>
              <p>{launches.length} launch record(s)</p>
              <p className="text-foreground-muted">All mutations require hash-matched approvals before execution.</p>
            </CardContent>
          </Card>
        </div>
      )}

      {mode === "accounts" && (
        <Card>
          <CardHeader><CardTitle>Assign customer account</CardTitle></CardHeader>
          <CardContent className="space-y-4 max-w-lg">
            <Input label="Customer ID" value={customerId} onChange={(e) => setCustomerId(e.target.value)} />
            <Input label="Manager (MCC) ID (optional)" value={managerId} onChange={(e) => setManagerId(e.target.value)} />
            <Button onClick={assignAccount} disabled={loading || !customerId}>Assign to brand</Button>
            {accountStatus?.assigned ? (
              <div className="rounded-md border p-3 text-sm">
                <p className="font-medium">Current assignment</p>
                <p>{accountStatus.assigned.customerId} · {accountStatus.assigned.status}</p>
                <p>Access: {accountStatus.assigned.accessLevel ?? "—"}</p>
              </div>
            ) : null}
          </CardContent>
        </Card>
      )}

      {mode === "drafts" && (
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Create draft from approved plan</CardTitle></CardHeader>
            <CardContent className="flex gap-3 items-end max-w-xl">
              <Input label="Campaign plan ID" value={planId} onChange={(e) => setPlanId(e.target.value)} />
              <Button onClick={createDraft} disabled={loading || !planId}>Generate draft</Button>
            </CardContent>
          </Card>
          {drafts.map((draft) => (
            <Card key={draft.id}>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>{draft.plan?.name ?? draft.id}</CardTitle>
                <Badge variant={STATUS_VARIANT[draft.status] ?? "muted"}>{draft.status}</Badge>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p>Validation: {draft.validationStatus}</p>
                <p>Type: {draft.campaignType}</p>
                {draft.mutationPlans?.[0] ? (
                  <p>Latest plan hash: <code>{draft.mutationPlans[0].planHash.slice(0, 16)}…</code></p>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => buildMutationPlan(draft.id)} disabled={loading}>
                    Build mutation plan
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {mode === "launches" && (
        <div className="space-y-3">
          {launches.map((launch) => (
            <Card key={launch.id}>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>{launch.plan?.name ?? launch.id}</CardTitle>
                <Badge variant={STATUS_VARIANT[launch.status] ?? "muted"}>{launch.status}</Badge>
              </CardHeader>
              <CardContent className="text-sm space-y-1">
                <p>Hash: <code>{launch.planHash.slice(0, 16)}…</code></p>
                {launch.launchedAt ? <p>Launched: {new Date(launch.launchedAt).toLocaleString()}</p> : null}
                <ButtonLink href={`/advertising/google/campaigns/${launch.id}`} size="sm" variant="outline">
                  View campaign
                </ButtonLink>
              </CardContent>
            </Card>
          ))}
          {launches.length === 0 ? <p className="text-sm text-foreground-muted">No launches yet.</p> : null}
        </div>
      )}

      {mode === "campaign-detail" && launchDetail && (
        <Card>
          <CardHeader><CardTitle>{launchDetail.plan?.name ?? "Campaign launch"}</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-2">
            <p>Status: {launchDetail.status}</p>
            <p>Mutation hash: <code>{launchDetail.planHash}</code></p>
            <div>
              <p className="font-medium mb-1">Provider resources</p>
              <ul className="list-disc pl-5">
                {(launchDetail.providerResources ?? []).map((r) => (
                  <li key={r.resourceType}>{r.resourceType}: {r.providerResourceName ?? "pending"}</li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>
      )}

      {mode === "operations" && (
        <div className="space-y-3">
          {operations.map((op) => (
            <Card key={op.id}>
              <CardContent className="pt-4 text-sm flex justify-between">
                <div>
                  <p className="font-medium">{op.operationType}</p>
                  <p className="text-foreground-muted">{op.reason}</p>
                </div>
                <Badge variant={STATUS_VARIANT[op.status] ?? "muted"}>{op.status}</Badge>
              </CardContent>
            </Card>
          ))}
          {operations.length === 0 ? <p className="text-sm text-foreground-muted">No management operations recorded.</p> : null}
        </div>
      )}
    </div>
  );
}
