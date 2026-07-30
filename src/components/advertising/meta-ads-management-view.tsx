"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button, ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { apiFetch } from "@/lib/api/client";

export type MetaAdsManagementViewMode =
  | "overview"
  | "accounts"
  | "assets"
  | "drafts"
  | "launches"
  | "campaign-detail"
  | "review";

const STATUS_VARIANT: Record<string, "default" | "muted" | "warning"> = {
  DRAFT: "muted",
  VALIDATED: "default",
  PENDING_APPROVAL: "warning",
  LAUNCHED: "default",
  FAILED: "warning",
  POLICY_REJECTED: "warning",
};

function MetaNav({ active, campaignId }: { active: MetaAdsManagementViewMode; campaignId?: string }) {
  const tabs: Array<{ mode: MetaAdsManagementViewMode; label: string; href: string }> = [
    { mode: "overview", label: "Overview", href: "/advertising/meta" },
    { mode: "accounts", label: "Accounts", href: "/advertising/meta/accounts" },
    { mode: "assets", label: "Assets", href: "/advertising/meta/assets" },
    { mode: "drafts", label: "Drafts", href: "/advertising/meta/drafts" },
    { mode: "launches", label: "Launches", href: "/advertising/meta/launches" },
    { mode: "review", label: "Review", href: "/advertising/meta/review" },
  ];
  if (campaignId) {
    tabs.push({ mode: "campaign-detail", label: "Campaign", href: `/advertising/meta/campaigns/${campaignId}` });
  }
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

export function MetaAdsManagementView({
  mode,
  campaignId,
  reviewDraftId,
}: {
  mode: MetaAdsManagementViewMode;
  campaignId?: string;
  reviewDraftId?: string;
}) {
  const { preference } = useWorkspace();
  const brandId = preference.currentBrandId;
  const organisationId = preference.currentOrganisationId;
  const base = brandId ? `/api/brands/${brandId}/advertising/meta` : null;

  const [accountStatus, setAccountStatus] = useState<Record<string, unknown> | null>(null);
  const [assets, setAssets] = useState<Record<string, unknown> | null>(null);
  const [drafts, setDrafts] = useState<Array<Record<string, unknown>>>([]);
  const [launches, setLaunches] = useState<Array<Record<string, unknown>>>([]);
  const [launchDetail, setLaunchDetail] = useState<Record<string, unknown> | null>(null);
  const [review, setReview] = useState<Record<string, unknown> | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [adAccountId, setAdAccountId] = useState("");
  const [facebookPageId, setFacebookPageId] = useState("");
  const [instagramAccountId, setInstagramAccountId] = useState("");
  const [pixelId, setPixelId] = useState("");
  const [planId, setPlanId] = useState("");

  const loadAccount = useCallback(async () => {
    if (!base || !organisationId) return;
    const res = await apiFetch<{ status: Record<string, unknown> }>(`${base}/accounts?organisationId=${organisationId}`);
    setAccountStatus(res.status);
  }, [base, organisationId]);

  const loadAssets = useCallback(async () => {
    if (!base || !organisationId) return;
    const res = await apiFetch<{ assets: Record<string, unknown> }>(`${base}/assets?organisationId=${organisationId}`);
    setAssets(res.assets);
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

  const loadCampaign = useCallback(async () => {
    if (!base || !organisationId || !campaignId) return;
    const res = await apiFetch<{ launch: Record<string, unknown> }>(`${base}/campaigns/${campaignId}?organisationId=${organisationId}`);
    setLaunchDetail(res.launch);
  }, [base, organisationId, campaignId]);

  const loadReview = useCallback(async () => {
    if (!base || !organisationId || !reviewDraftId) return;
    const res = await apiFetch<{ review: Record<string, unknown> }>(`${base}/review/${reviewDraftId}?organisationId=${organisationId}`);
    setReview(res.review);
  }, [base, organisationId, reviewDraftId]);

  useEffect(() => {
    void loadAccount();
    if (mode === "assets") void loadAssets();
    if (mode === "drafts" || mode === "overview" || mode === "review") void loadDrafts();
    if (mode === "launches" || mode === "overview") void loadLaunches();
    if (mode === "campaign-detail") void loadCampaign();
    if (mode === "review" && reviewDraftId) void loadReview();
  }, [mode, loadAccount, loadAssets, loadDrafts, loadLaunches, loadCampaign, loadReview, reviewDraftId]);

  async function assignAssets() {
    if (!base || !organisationId || !adAccountId || !facebookPageId) return;
    setLoading(true);
    try {
      await apiFetch(`${base}/accounts?organisationId=${organisationId}`, {
        method: "POST",
        body: JSON.stringify({ action: "assign", adAccountId, facebookPageId, instagramAccountId: instagramAccountId || undefined, pixelId: pixelId || undefined }),
      });
      setMessage("Meta assets assigned (explicit selection required).");
      await loadAccount();
    } finally {
      setLoading(false);
    }
  }

  async function createDraft() {
    if (!base || !organisationId || !planId) return;
    setLoading(true);
    try {
      await apiFetch(`${base}/drafts?organisationId=${organisationId}`, {
        method: "POST",
        body: JSON.stringify({ action: "create-from-plan", planId }),
      });
      setMessage("Meta provider draft created (no mutations sent).");
      await loadDrafts();
    } finally {
      setLoading(false);
    }
  }

  async function buildMutationPlan(draftId: string) {
    if (!base || !organisationId) return;
    setLoading(true);
    try {
      const res = await apiFetch<{ planHash: string }>(`${base}/drafts/${draftId}?organisationId=${organisationId}`, {
        method: "POST",
        body: JSON.stringify({ action: "build-mutation-plan" }),
      });
      setMessage(`Mutation plan hash: ${res.planHash?.slice(0, 12)}…`);
      await loadDrafts();
    } finally {
      setLoading(false);
    }
  }

  const assigned = accountStatus?.assigned as Record<string, unknown> | undefined;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Meta Ads Management"
        description="Controlled Facebook and Instagram campaign management with explicit asset selection and hash-bound approvals."
      />
      <MetaNav active={mode} campaignId={campaignId} />
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}

      {mode === "overview" && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Account & assets</CardTitle></CardHeader>
            <CardContent className="text-sm space-y-1">
              {assigned ? (
                <>
                  <p>Ad account: {String(assigned.adAccountId)}</p>
                  <p>Page: {String(assigned.facebookPageName ?? assigned.facebookPageId)}</p>
                  <p>Currency: {String(assigned.currency ?? "—")}</p>
                </>
              ) : (
                <p className="text-muted-foreground">No Meta assets assigned.</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Pipeline</CardTitle></CardHeader>
            <CardContent className="text-sm">
              <p>{drafts.length} draft(s) · {launches.length} launch(es)</p>
              <p className="text-muted-foreground mt-2">Campaign → Ad Set → Ad → Creative hierarchy.</p>
            </CardContent>
          </Card>
        </div>
      )}

      {mode === "accounts" && (
        <Card>
          <CardHeader><CardTitle>Assign ad account & Page</CardTitle></CardHeader>
          <CardContent className="space-y-3 max-w-lg">
            <Input label="Ad account ID" value={adAccountId} onChange={(e) => setAdAccountId(e.target.value)} />
            <Input label="Facebook Page ID" value={facebookPageId} onChange={(e) => setFacebookPageId(e.target.value)} />
            <Input label="Instagram account ID (optional)" value={instagramAccountId} onChange={(e) => setInstagramAccountId(e.target.value)} />
            <Input label="Pixel ID (optional)" value={pixelId} onChange={(e) => setPixelId(e.target.value)} />
            <Button onClick={assignAssets} disabled={loading || !adAccountId || !facebookPageId}>Assign assets</Button>
          </CardContent>
        </Card>
      )}

      {mode === "assets" && (
        <Card>
          <CardHeader><CardTitle>Available assets</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-2">
            <p>Businesses: {Array.isArray(assets?.businesses) ? (assets.businesses as unknown[]).length : 0}</p>
            <p>Ad accounts: {Array.isArray(assets?.adAccounts) ? (assets.adAccounts as unknown[]).length : 0}</p>
            <p>Pages: {Array.isArray(assets?.pages) ? (assets.pages as unknown[]).length : 0}</p>
            <p>Pixels: {Array.isArray(assets?.pixels) ? (assets.pixels as unknown[]).length : 0}</p>
            <p className="text-muted-foreground">Assets are never auto-selected — choose explicitly on the Accounts tab.</p>
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
            <Card key={String(draft.id)}>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>{String((draft.plan as Record<string, unknown>)?.name ?? draft.id)}</CardTitle>
                <Badge variant={STATUS_VARIANT[String(draft.status)] ?? "muted"}>{String(draft.status)}</Badge>
              </CardHeader>
              <CardContent className="text-sm space-y-2">
                <p>Objective: {String(draft.objective ?? "—")}</p>
                <p>Validation: {String(draft.validationStatus)}</p>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => buildMutationPlan(String(draft.id))} disabled={loading}>
                    Build mutation plan
                  </Button>
                  <ButtonLink href={`/advertising/meta/review?draftId=${draft.id}`} size="sm" variant="outline">Review</ButtonLink>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {mode === "launches" && (
        <div className="space-y-3">
          {launches.map((launch) => (
            <Card key={String(launch.id)}>
              <CardHeader className="flex flex-row justify-between">
                <CardTitle>{String((launch.plan as Record<string, unknown>)?.name ?? launch.id)}</CardTitle>
                <Badge variant={STATUS_VARIANT[String(launch.status)] ?? "muted"}>{String(launch.status)}</Badge>
              </CardHeader>
              <CardContent>
                <ButtonLink href={`/advertising/meta/campaigns/${launch.id}`} size="sm" variant="outline">View</ButtonLink>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {mode === "campaign-detail" && launchDetail && (
        <Card>
          <CardHeader><CardTitle>Campaign launch</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-1">
            <p>Status: {String(launchDetail.status)}</p>
            <p>Policy: {String(launchDetail.policyStatus ?? "—")}</p>
            <p>Hash: <code>{String(launchDetail.planHash).slice(0, 16)}…</code></p>
          </CardContent>
        </Card>
      )}

      {mode === "review" && (
        <Card>
          <CardHeader><CardTitle>Policy & validation review</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-2">
            {reviewDraftId && review ? (
              <>
                <p>Status: {String(review.validationStatus)}</p>
                <p className="text-muted-foreground">{String(review.localOnlyDisclaimer)}</p>
                <pre className="rounded bg-muted p-3 text-xs overflow-auto">{JSON.stringify(review.validationResult, null, 2)}</pre>
              </>
            ) : (
              <p className="text-muted-foreground">Select a draft from the Drafts tab to review validation findings.</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
