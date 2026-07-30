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

export type CreativeStudioViewMode =
  | "list"
  | "new"
  | "detail"
  | "variants"
  | "review"
  | "validation"
  | "history";

type CreativeProject = {
  id: string;
  name: string;
  description?: string | null;
  status: string;
  primaryFormat?: string | null;
  channelType?: string | null;
  objectiveType?: string | null;
  campaignPlan?: { id: string; name: string; primaryObjective?: string | null } | null;
  concepts?: Array<{ id: string; category: string; message: string; hypothesis?: string | null; complianceRisk?: string | null }>;
  variants?: Array<{ id: string; variantLabel: string; hypothesis?: string | null; hook?: string | null; headline?: string | null }>;
  copies?: Array<{ id: string; fieldKey: string; fieldValue: string; characterCount: number; maxLength?: number | null; isLocked: boolean; truncationWarning?: string | null }>;
  assets?: Array<{ id: string; source: string; provenanceLabel?: string | null; isSynthetic: boolean; syntheticDisclaimer?: string | null }>;
  reviews?: Array<{ id: string; reviewerRole: string; decision: string; comment?: string | null }>;
  validations?: Array<{ id: string; provider: string; validationStatus: string; warnings: string[]; errors: string[] }>;
  versions?: Array<{ id: string; versionNumber: number; changeNote?: string | null; createdAt: string }>;
  _count?: { variants: number; concepts: number; reviews: number };
};

const STATUS_VARIANT: Record<string, "default" | "muted" | "warning"> = {
  DRAFT: "muted",
  GENERATING: "warning",
  IN_REVIEW: "warning",
  APPROVED: "default",
  CHANGES_REQUESTED: "warning",
};

const FORMAT_OPTIONS = [
  "SEARCH_TEXT_AD",
  "RESPONSIVE_SEARCH_AD",
  "SINGLE_IMAGE",
  "CAROUSEL",
  "STORY",
  "REEL",
  "SHORT_VIDEO",
  "DISPLAY_BANNER",
];

function CreativeNav({ creativeId, active }: { creativeId: string; active: CreativeStudioViewMode }) {
  const tabs: Array<{ mode: CreativeStudioViewMode; label: string; href: string }> = [
    { mode: "detail", label: "Overview", href: `/advertising/creatives/${creativeId}` },
    { mode: "variants", label: "Variants", href: `/advertising/creatives/${creativeId}/variants` },
    { mode: "review", label: "Review", href: `/advertising/creatives/${creativeId}/review` },
    { mode: "validation", label: "Validation", href: `/advertising/creatives/${creativeId}/validation` },
    { mode: "history", label: "History", href: `/advertising/creatives/${creativeId}/history` },
  ];

  return (
    <nav className="flex flex-wrap gap-2 border-b border-slate-200 pb-3" aria-label="Creative project sections">
      {tabs.map((tab) => (
        <Link
          key={tab.mode}
          href={tab.href}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            active === tab.mode ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}

export function AdvertisingCreativeStudioView({
  mode,
  creativeId,
}: {
  mode: CreativeStudioViewMode;
  creativeId?: string;
}) {
  const { preference } = useWorkspace();
  const brandId = preference.currentBrandId;
  const organisationId = preference.currentOrganisationId;

  const [projects, setProjects] = useState<CreativeProject[]>([]);
  const [project, setProject] = useState<CreativeProject | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [newName, setNewName] = useState("");
  const [newFormat, setNewFormat] = useState("SINGLE_IMAGE");
  const [campaignPlanId, setCampaignPlanId] = useState("");
  const [variantLabel, setVariantLabel] = useState("Variant A");
  const [provider, setProvider] = useState("META");

  const apiBase = useMemo(() => {
    if (!brandId) return null;
    return `/api/brands/${brandId}/advertising/creatives`;
  }, [brandId]);

  const loadProjects = useCallback(async () => {
    if (!apiBase || !organisationId) return;
    const data = await apiFetch<{ items: CreativeProject[] }>(`${apiBase}?organisationId=${organisationId}`, { organisationId });
    setProjects(data.items);
  }, [apiBase, organisationId]);

  const loadProject = useCallback(async () => {
    if (!apiBase || !organisationId || !creativeId) return;
    const data = await apiFetch<{ project: CreativeProject }>(`${apiBase}/${creativeId}?organisationId=${organisationId}`, { organisationId });
    setProject(data.project);
  }, [apiBase, organisationId, creativeId]);

  useEffect(() => {
    void (async () => {
      try {
        if (mode === "list") await loadProjects();
        if (creativeId && mode !== "list" && mode !== "new") await loadProject();
      } catch {
        setMessage("Failed to load creative studio data.");
      }
    })();
  }, [mode, creativeId, loadProjects, loadProject]);

  async function postAction(action: string, payload: Record<string, unknown> = {}) {
    if (!apiBase || !organisationId || !creativeId) return;
    setLoading(true);
    setMessage(null);
    try {
      await apiFetch(`${apiBase}/${creativeId}?organisationId=${organisationId}`, {
        method: "POST",
        organisationId,
        body: JSON.stringify({ action, ...payload }),
      });
      await loadProject();
      setMessage(`Action "${action}" completed.`);
    } catch {
      setMessage(`Action "${action}" failed.`);
    } finally {
      setLoading(false);
    }
  }

  async function createProject() {
    if (!apiBase || !organisationId || !newName) return;
    setLoading(true);
    try {
      const data = await apiFetch<{ project: CreativeProject }>(`${apiBase}?organisationId=${organisationId}`, {
        method: "POST",
        organisationId,
        body: JSON.stringify({
          name: newName,
          primaryFormat: newFormat,
          campaignPlanId: campaignPlanId || undefined,
        }),
      });
      window.location.href = `/advertising/creatives/${data.project.id}`;
    } catch {
      setMessage("Failed to create creative project.");
      setLoading(false);
    }
  }

  if (!brandId || !organisationId) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-slate-600">
          Select a brand workspace to manage advertising creatives.
        </CardContent>
      </Card>
    );
  }

  if (mode === "list") {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Advertising Creatives"
          description="Generate, review and approve ad copy and creative packages."
          actions={<ButtonLink href="/advertising/creatives/new">New creative project</ButtonLink>}
        />
        {message ? <p className="text-sm text-red-600">{message}</p> : null}
        <Card>
          <CardContent className="divide-y divide-slate-100 p-0">
            {projects.length === 0 ? (
              <p className="p-6 text-sm text-slate-600">No creative projects yet.</p>
            ) : (
              projects.map((p) => (
                <Link
                  key={p.id}
                  href={`/advertising/creatives/${p.id}`}
                  className="flex items-center justify-between px-6 py-4 hover:bg-slate-50"
                >
                  <div>
                    <p className="font-medium text-slate-900">{p.name}</p>
                    <p className="text-xs text-slate-500">
                      {p.primaryFormat?.replace(/_/g, " ") ?? "No format"} · {p.campaignPlan?.name ?? "No plan"}
                    </p>
                  </div>
                  <Badge variant={STATUS_VARIANT[p.status] ?? "muted"}>{p.status}</Badge>
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
        <PageHeader title="New Creative Project" description="Start from a campaign plan or create standalone creatives." />
        <Card>
          <CardContent className="space-y-4 pt-6">
            <Input label="Project name" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Q1 Lead Gen — Meta Carousel" />
            <Input label="Campaign plan ID (optional)" value={campaignPlanId} onChange={(e) => setCampaignPlanId(e.target.value)} placeholder="Link to existing plan" />
            <div>
              <label className="text-sm font-medium text-slate-700">Primary format</label>
              <select
                className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                value={newFormat}
                onChange={(e) => setNewFormat(e.target.value)}
              >
                {FORMAT_OPTIONS.map((f) => (
                  <option key={f} value={f}>{f.replace(/_/g, " ")}</option>
                ))}
              </select>
            </div>
            <Button onClick={() => void createProject()} disabled={loading || !newName}>Create project</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!project) return <p className="text-sm text-slate-600">Loading creative project…</p>;

  return (
    <div className="space-y-6">
      <PageHeader
        title={project.name}
        description={project.primaryFormat?.replace(/_/g, " ") ?? "Creative project"}
        actions={<Badge variant={STATUS_VARIANT[project.status] ?? "muted"}>{project.status}</Badge>}
      />
      {creativeId ? <CreativeNav creativeId={creativeId} active={mode} /> : null}
      {message ? <p className="text-sm text-slate-600">{message}</p> : null}

      {mode === "detail" ? (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader><CardTitle className="text-base">Project summary</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p><span className="text-slate-500">Format:</span> {project.primaryFormat ?? "—"}</p>
              <p><span className="text-slate-500">Channel:</span> {project.channelType ?? "—"}</p>
              <p><span className="text-slate-500">Campaign plan:</span> {project.campaignPlan?.name ?? "—"}</p>
              <p><span className="text-slate-500">Concepts:</span> {project.concepts?.length ?? 0}</p>
              <p><span className="text-slate-500">Variants:</span> {project.variants?.length ?? 0}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">AI generation</CardTitle></CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" disabled={loading} onClick={() => void postAction("generate-concepts")}>
                Generate concepts
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={loading || !project.primaryFormat}
                onClick={() => void postAction("generate-copy", { formatType: project.primaryFormat })}
              >
                Generate copy
              </Button>
              <Button size="sm" variant="outline" disabled={loading} onClick={() => void postAction("submit-review")}>
                Submit for review
              </Button>
            </CardContent>
          </Card>
          {(project.concepts ?? []).length > 0 ? (
            <Card className="md:col-span-2">
              <CardHeader><CardTitle className="text-base">Concepts</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                {project.concepts!.map((c) => (
                  <div key={c.id} className="rounded border border-slate-200 px-3 py-2">
                    <p className="font-medium">{c.category.replace(/_/g, " ")}</p>
                    <p className="text-slate-600">{c.message}</p>
                    {c.complianceRisk ? <p className="mt-1 text-xs text-amber-700">Risk: {c.complianceRisk}</p> : null}
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}
          {(project.copies ?? []).length > 0 ? (
            <Card className="md:col-span-2">
              <CardHeader><CardTitle className="text-base">Copy fields</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                {project.copies!.map((c) => (
                  <div key={c.id} className="flex justify-between rounded border border-slate-200 px-3 py-2">
                    <div>
                      <span className="font-medium">{c.fieldKey}</span>: {c.fieldValue}
                      {c.isLocked ? <Badge className="ml-2">Locked</Badge> : null}
                    </div>
                    <span className={c.truncationWarning ? "text-red-600" : "text-slate-500"}>
                      {c.characterCount}{c.maxLength ? `/${c.maxLength}` : ""}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}
        </div>
      ) : null}

      {mode === "variants" ? (
        <Card>
          <CardHeader><CardTitle className="text-base">Variants</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <ul className="space-y-2 text-sm">
              {(project.variants ?? []).map((v) => (
                <li key={v.id} className="rounded border border-slate-200 px-3 py-2">
                  <p className="font-medium">{v.variantLabel}</p>
                  {v.hypothesis ? <p className="text-slate-500">Hypothesis: {v.hypothesis}</p> : null}
                  {v.headline ? <p>Headline: {v.headline}</p> : null}
                </li>
              ))}
            </ul>
            <div className="flex gap-2">
              <Input label="Variant label" value={variantLabel} onChange={(e) => setVariantLabel(e.target.value)} />
              <Button
                size="sm"
                className="mt-6"
                disabled={loading}
                onClick={() => void postAction("add-variant", { variantLabel, hypothesis: "Test hook variation" })}
              >
                Add variant
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {mode === "review" ? (
        <Card>
          <CardHeader><CardTitle className="text-base">Creative review</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-slate-600">Reviews by marketer, brand owner, compliance, budget owner, and client approver.</p>
            <ul className="space-y-2 text-sm">
              {(project.reviews ?? []).map((r) => (
                <li key={r.id} className="flex justify-between rounded border border-slate-200 px-3 py-2">
                  <span>{r.reviewerRole}</span>
                  <Badge variant={r.decision === "APPROVED" ? "default" : "muted"}>{r.decision}</Badge>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-2">
              {["MARKETER", "COMPLIANCE_REVIEWER", "BRAND_OWNER"].map((role) => (
                <Button
                  key={role}
                  size="sm"
                  variant="outline"
                  disabled={loading}
                  onClick={() => void postAction("review", { reviewerRole: role, decision: "APPROVED" })}
                >
                  Approve as {role.toLowerCase().replace(/_/g, " ")}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {mode === "validation" ? (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Provider validation</CardTitle>
            <div className="flex gap-2">
              <Input label="Provider" value={provider} onChange={(e) => setProvider(e.target.value)} />
              <Button
                size="sm"
                className="mt-6"
                disabled={loading}
                onClick={() => void postAction("validate-provider", { provider, formatType: project.primaryFormat })}
              >
                Run pre-check
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-xs text-slate-500">Local pre-check only — not provider approval.</p>
            <ul className="space-y-2 text-sm">
              {(project.validations ?? []).map((v) => (
                <li key={v.id} className="rounded border border-slate-200 px-3 py-2">
                  <div className="flex justify-between">
                    <span className="font-medium">{v.provider}</span>
                    <Badge variant={v.validationStatus === "FAILED" ? "warning" : "default"}>{v.validationStatus}</Badge>
                  </div>
                  {v.errors.length > 0 ? <p className="mt-1 text-red-600">{v.errors.join("; ")}</p> : null}
                  {v.warnings.length > 0 ? <p className="mt-1 text-amber-700">{v.warnings.join("; ")}</p> : null}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      {mode === "history" ? (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Version history</CardTitle>
            <Button size="sm" variant="outline" disabled={loading} onClick={() => void postAction("create-version", { changeNote: "Manual snapshot" })}>
              Create version
            </Button>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {(project.versions ?? []).map((v) => (
                <li key={v.id} className="rounded border border-slate-200 px-3 py-2">
                  <span className="font-medium">v{v.versionNumber}</span>
                  {v.changeNote ? <span className="text-slate-500"> — {v.changeNote}</span> : null}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
