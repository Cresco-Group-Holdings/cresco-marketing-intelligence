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

export type FormsViewMode =
  | "list"
  | "new"
  | "detail"
  | "builder"
  | "submissions"
  | "installation"
  | "analytics"
  | "versions";

function FormsNav({ active, formId }: { active: FormsViewMode; formId?: string }) {
  if (!formId) {
    return (
      <nav className="flex gap-2 border-b pb-3 mb-6">
        <Link href="/forms" className={`rounded-md px-3 py-1.5 text-sm ${active === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>All forms</Link>
      </nav>
    );
  }
  const tabs = [
    { mode: "detail" as const, label: "Overview", href: `/forms/${formId}` },
    { mode: "builder" as const, label: "Builder", href: `/forms/${formId}/builder` },
    { mode: "submissions" as const, label: "Submissions", href: `/forms/${formId}/submissions` },
    { mode: "installation" as const, label: "Installation", href: `/forms/${formId}/installation` },
    { mode: "analytics" as const, label: "Analytics", href: `/forms/${formId}/analytics` },
    { mode: "versions" as const, label: "Versions", href: `/forms/${formId}/versions` },
  ];
  return (
    <nav className="flex flex-wrap gap-2 border-b pb-3 mb-6">
      <Link href="/forms" className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted">← Forms</Link>
      {tabs.map((tab) => (
        <Link key={tab.href} href={tab.href} className={`rounded-md px-3 py-1.5 text-sm ${active === tab.mode ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}

type Props = { mode: FormsViewMode; formId?: string };

export function FormsView({ mode, formId }: Props) {
  const { preference } = useWorkspace();
  const brandId = preference.currentBrandId;
  const organisationId = preference.currentOrganisationId;
  const base = brandId ? `/api/brands/${brandId}/forms` : null;

  const [forms, setForms] = useState<Array<Record<string, unknown>>>([]);
  const [form, setForm] = useState<Record<string, unknown> | null>(null);
  const [submissions, setSubmissions] = useState<Array<Record<string, unknown>>>([]);
  const [analytics, setAnalytics] = useState<Record<string, unknown> | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [formType, setFormType] = useState("CONTACT");
  const [fieldKey, setFieldKey] = useState("email");
  const [fieldLabel, setFieldLabel] = useState("Email");
  const [fieldType, setFieldType] = useState("EMAIL");

  const loadData = useCallback(async () => {
    if (!base || !organisationId) return;
    setLoading(true);
    try {
      if (mode === "list" || mode === "new") {
        const res = await apiFetch<{ forms: Array<Record<string, unknown>> }>(`${base}?organisationId=${organisationId}`);
        setForms(res.forms);
      } else if (formId) {
        const res = await apiFetch<{ form: Record<string, unknown> }>(`${base}?organisationId=${organisationId}&formId=${formId}`);
        setForm(res.form);
        if (mode === "submissions") {
          const sub = await apiFetch<{ submissions: Array<Record<string, unknown>> }>(
            `${base}?organisationId=${organisationId}&formId=${formId}&view=submissions`,
          );
          setSubmissions(sub.submissions);
        }
        if (mode === "analytics") {
          const ana = await apiFetch<{ analytics: Record<string, unknown> }>(
            `${base}?organisationId=${organisationId}&formId=${formId}&view=analytics`,
          );
          setAnalytics(ana.analytics);
        }
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Failed to load forms.");
    } finally {
      setLoading(false);
    }
  }, [base, organisationId, mode, formId]);

  useEffect(() => { loadData(); }, [loadData]);

  async function postAction(body: Record<string, unknown>) {
    if (!base || !organisationId) return;
    setLoading(true);
    setMessage(null);
    try {
      const res = await apiFetch<{ form?: Record<string, unknown> }>(`${base}?organisationId=${organisationId}`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      setMessage("Action completed.");
      if (res.form && mode === "new") {
        window.location.href = `/forms/${res.form.id}/builder`;
        return;
      }
      await loadData();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Action failed.");
    } finally {
      setLoading(false);
    }
  }

  const publicFormId = form?.publicFormId as string | undefined;
  const versions = (form?.versions as Array<Record<string, unknown>>) ?? [];
  const activeVersion = versions.find((v) => v.isActive) ?? versions[0];
  const fields = (activeVersion?.fields as Array<Record<string, unknown>>) ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Lead Capture Forms"
        description="Build secure first-party forms with consent, attribution, and CRM routing."
      />
      <FormsNav active={mode} formId={formId} />
      {message && <p className="text-sm text-muted-foreground">{message}</p>}
      {loading && <p className="text-sm text-muted-foreground">Loading…</p>}

      {mode === "list" && (
        <div className="space-y-4">
          <Link href="/forms/new"><Button>Create form</Button></Link>
          <div className="space-y-2">
            {forms.map((f) => (
              <Card key={String(f.id)}>
                <CardContent className="flex items-center justify-between py-4">
                  <div>
                    <Link href={`/forms/${f.id}`} className="font-medium hover:underline">{String(f.name)}</Link>
                    <div className="flex gap-2 mt-1">
                      <Badge variant="muted">{String(f.status)}</Badge>
                      <Badge variant="muted">{String(f.formType)}</Badge>
                    </div>
                  </div>
                  <code className="text-xs text-muted-foreground">{String(f.publicFormId)}</code>
                </CardContent>
              </Card>
            ))}
            {forms.length === 0 && <p className="text-sm text-muted-foreground">No forms yet.</p>}
          </div>
        </div>
      )}

      {mode === "new" && (
        <Card>
          <CardHeader><CardTitle>New form</CardTitle></CardHeader>
          <CardContent className="space-y-3 max-w-lg">
            <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Contact us" />
            <Input label="Slug" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="contact-us" />
            <Input label="Form type" value={formType} onChange={(e) => setFormType(e.target.value)} placeholder="CONTACT" />
            <Button onClick={() => postAction({ action: "createForm", name, slug, formType })}>Create form</Button>
          </CardContent>
        </Card>
      )}

      {mode === "detail" && form && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>{String(form.name)}</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>Status: <Badge>{String(form.status)}</Badge></p>
              <p>Type: {String(form.formType)}</p>
              <p>Public ID: <code>{publicFormId}</code></p>
              <p>Fields: {fields.length}</p>
              <Button onClick={() => postAction({ action: "publishForm", formId })}>Publish form</Button>
            </CardContent>
          </Card>
        </div>
      )}

      {mode === "builder" && form && (
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Form builder</CardTitle></CardHeader>
            <CardContent className="space-y-3 max-w-lg">
              <Input label="Field key" value={fieldKey} onChange={(e) => setFieldKey(e.target.value)} />
              <Input label="Label" value={fieldLabel} onChange={(e) => setFieldLabel(e.target.value)} />
              <Input label="Field type" value={fieldType} onChange={(e) => setFieldType(e.target.value)} />
              <Button onClick={() => postAction({ action: "addField", formId, fieldKey, fieldType, label: fieldLabel, isRequired: fieldType === "EMAIL" })}>
                Add field
              </Button>
            </CardContent>
          </Card>
          <div className="space-y-2">
            {fields.map((f, i) => (
              <Card key={String(f.id)}>
                <CardContent className="py-3 flex justify-between text-sm">
                  <span>{i + 1}. {String(f.label)}</span>
                  <Badge variant="muted">{String(f.fieldType)}</Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {mode === "submissions" && (
        <div className="space-y-2">
          {submissions.map((s) => (
            <Card key={String(s.id)}>
              <CardContent className="py-4 flex justify-between text-sm">
                <span>{new Date(String(s.createdAt)).toLocaleString()}</span>
                <Badge variant="muted">{String(s.status)}</Badge>
              </CardContent>
            </Card>
          ))}
          {submissions.length === 0 && <p className="text-sm text-muted-foreground">No submissions yet.</p>}
        </div>
      )}

      {mode === "installation" && publicFormId && (
        <Card>
          <CardHeader><CardTitle>Embed installation</CardTitle></CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div>
              <h3 className="font-medium mb-2">JavaScript embed (CSP-compatible)</h3>
              <pre className="bg-muted p-3 rounded text-xs overflow-auto">{`<script src="/embed/forms.js" data-form-id="${publicFormId}" async></script>
<div id="cresco-form-${publicFormId}"></div>`}</pre>
            </div>
            <div>
              <h3 className="font-medium mb-2">API submission</h3>
              <pre className="bg-muted p-3 rounded text-xs overflow-auto">{`POST /api/forms/v1/${publicFormId}/submit
Content-Type: application/json
X-Idempotency-Key: <unique-key>

{"fields":{"email":"user@example.com"},"attribution":{"pageUrl":"..."}}`}</pre>
            </div>
            <div>
              <h3 className="font-medium mb-2">Hosted page</h3>
              <p className="text-muted-foreground">/forms/hosted/{publicFormId} (configure in production)</p>
            </div>
          </CardContent>
        </Card>
      )}

      {mode === "analytics" && analytics && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card><CardHeader><CardTitle className="text-sm">Submissions</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{String(analytics.total)}</CardContent></Card>
          <Card><CardHeader><CardTitle className="text-sm">Accepted</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{String(analytics.accepted)}</CardContent></Card>
          <Card><CardHeader><CardTitle className="text-sm">Quarantined</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{String(analytics.quarantined)}</CardContent></Card>
        </div>
      )}

      {mode === "versions" && (
        <div className="space-y-2">
          {versions.map((v) => (
            <Card key={String(v.id)}>
              <CardContent className="py-4 flex justify-between text-sm">
                <span>v{String(v.versionNumber)} — {String(v.label ?? "")}</span>
                {v.isActive ? <Badge>Active</Badge> : <Badge variant="muted">Draft</Badge>}
              </CardContent>
            </Card>
          ))}
          <Button variant="outline" onClick={() => postAction({ action: "createVersion", formId })}>Create new version</Button>
        </div>
      )}
    </div>
  );
}
