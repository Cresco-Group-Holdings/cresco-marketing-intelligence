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

export type CrmViewMode =
  | "overview"
  | "leads"
  | "leadNew"
  | "leadDetail"
  | "contacts"
  | "contactDetail"
  | "companies"
  | "companyDetail"
  | "duplicates"
  | "import"
  | "fields";

function CrmNav({ active }: { active: CrmViewMode }) {
  const tabs: Array<{ mode: CrmViewMode; label: string; href: string }> = [
    { mode: "overview", label: "Overview", href: "/crm" },
    { mode: "leads", label: "Leads", href: "/crm/leads" },
    { mode: "contacts", label: "Contacts", href: "/crm/contacts" },
    { mode: "companies", label: "Companies", href: "/crm/companies" },
    { mode: "duplicates", label: "Duplicates", href: "/crm/duplicates" },
    { mode: "import", label: "Import", href: "/crm/import" },
    { mode: "fields", label: "Fields", href: "/crm/settings/fields" },
  ];
  return (
    <nav className="flex flex-wrap gap-2 border-b pb-3 mb-6">
      {tabs.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          className={`rounded-md px-3 py-1.5 text-sm ${active === tab.mode || (active === "leadNew" && tab.mode === "leads") || (active === "leadDetail" && tab.mode === "leads") || (active === "contactDetail" && tab.mode === "contacts") || (active === "companyDetail" && tab.mode === "companies") ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}

type CrmViewProps = {
  mode: CrmViewMode;
  leadId?: string;
  contactId?: string;
  companyId?: string;
};

export function CrmView({ mode, leadId, contactId, companyId }: CrmViewProps) {
  const { preference } = useWorkspace();
  const brandId = preference.currentBrandId;
  const organisationId = preference.currentOrganisationId;
  const base = brandId ? `/api/brands/${brandId}/crm` : null;

  const [dashboard, setDashboard] = useState<Record<string, number> | null>(null);
  const [leads, setLeads] = useState<Array<Record<string, unknown>>>([]);
  const [lead, setLead] = useState<Record<string, unknown> | null>(null);
  const [contacts, setContacts] = useState<Array<Record<string, unknown>>>([]);
  const [contact, setContact] = useState<Record<string, unknown> | null>(null);
  const [companies, setCompanies] = useState<Array<Record<string, unknown>>>([]);
  const [company, setCompany] = useState<Record<string, unknown> | null>(null);
  const [duplicates, setDuplicates] = useState<Array<Record<string, unknown>>>([]);
  const [fields, setFields] = useState<Array<Record<string, unknown>>>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [productInterest, setProductInterest] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [csvRows, setCsvRows] = useState("");
  const [fieldKey, setFieldKey] = useState("");
  const [fieldLabel, setFieldLabel] = useState("");
  const [fieldType, setFieldType] = useState("TEXT");
  const [mergeSourceId, setMergeSourceId] = useState("");
  const [mergeDestId, setMergeDestId] = useState("");
  const [mergePreview, setMergePreview] = useState<Record<string, unknown> | null>(null);

  const loadData = useCallback(async () => {
    if (!base || !organisationId) return;
    setLoading(true);
    try {
      if (mode === "overview") {
        const res = await apiFetch<{ dashboard: Record<string, number> }>(
          `${base}?organisationId=${organisationId}&view=dashboard`,
        );
        setDashboard(res.dashboard);
      } else if (mode === "leads") {
        const qs = statusFilter ? `&status=${statusFilter}` : "";
        const res = await apiFetch<{ leads: Array<Record<string, unknown>> }>(
          `${base}?organisationId=${organisationId}${qs}`,
        );
        setLeads(res.leads);
      } else if (mode === "leadDetail" && leadId) {
        const res = await apiFetch<{ lead: Record<string, unknown> }>(
          `${base}?organisationId=${organisationId}&leadId=${leadId}`,
        );
        setLead(res.lead);
      } else if (mode === "contacts") {
        const res = await apiFetch<{ contacts: Array<Record<string, unknown>> }>(
          `${base}?organisationId=${organisationId}&view=contacts`,
        );
        setContacts(res.contacts);
      } else if (mode === "contactDetail" && contactId) {
        const res = await apiFetch<{ contact: Record<string, unknown> }>(
          `${base}?organisationId=${organisationId}&contactId=${contactId}`,
        );
        setContact(res.contact);
      } else if (mode === "companies") {
        const res = await apiFetch<{ companies: Array<Record<string, unknown>> }>(
          `${base}?organisationId=${organisationId}&view=companies`,
        );
        setCompanies(res.companies);
      } else if (mode === "companyDetail" && companyId) {
        const res = await apiFetch<{ company: Record<string, unknown> }>(
          `${base}?organisationId=${organisationId}&companyId=${companyId}`,
        );
        setCompany(res.company);
      } else if (mode === "duplicates") {
        const res = await apiFetch<{ duplicates: Array<Record<string, unknown>> }>(
          `${base}?organisationId=${organisationId}&view=duplicates`,
        );
        setDuplicates(res.duplicates);
      } else if (mode === "fields") {
        const res = await apiFetch<{ fields: Array<Record<string, unknown>> }>(
          `${base}?organisationId=${organisationId}&view=customFields`,
        );
        setFields(res.fields);
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Failed to load CRM data.");
    } finally {
      setLoading(false);
    }
  }, [base, organisationId, mode, leadId, contactId, companyId, statusFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function postAction(body: Record<string, unknown>) {
    if (!base || !organisationId) return;
    setLoading(true);
    setMessage(null);
    try {
      await apiFetch(`${base}?organisationId=${organisationId}`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      setMessage("Action completed.");
      await loadData();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Action failed.");
    } finally {
      setLoading(false);
    }
  }

  const timeline = (lead?.timelineItems as Array<Record<string, unknown>>) ?? [];
  const person = lead?.person as Record<string, unknown> | undefined;
  const contactMethods = (person?.contactMethods as Array<Record<string, unknown>>) ?? [];
  const source = lead?.source as Record<string, unknown> | undefined;

  return (
    <div className="space-y-6">
      <PageHeader
        title="CRM"
        description="Tenant-safe lead, contact, and company records with attribution, consent, and identity evidence."
      />
      <CrmNav active={mode} />
      {message && <p className="text-sm text-muted-foreground">{message}</p>}
      {loading && <p className="text-sm text-muted-foreground">Loading…</p>}

      {mode === "overview" && dashboard && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card><CardHeader><CardTitle className="text-sm">Leads</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{dashboard.leads}</CardContent></Card>
          <Card><CardHeader><CardTitle className="text-sm">Unassigned</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{dashboard.unassigned}</CardContent></Card>
          <Card><CardHeader><CardTitle className="text-sm">Companies</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{dashboard.companies}</CardContent></Card>
          <Card><CardHeader><CardTitle className="text-sm">Pending duplicates</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{dashboard.duplicates}</CardContent></Card>
        </div>
      )}

      {mode === "leads" && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2 items-center">
            <Input label="Filter by status" placeholder="Filter by status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="max-w-xs" />
            <Button variant="outline" onClick={loadData}>Apply filter</Button>
            <Link href="/crm/leads/new"><Button>Create lead</Button></Link>
          </div>
          <div className="space-y-2">
            {leads.map((l) => (
              <Card key={String(l.id)}>
                <CardContent className="flex items-center justify-between py-4">
                  <div>
                    <Link href={`/crm/leads/${l.id}`} className="font-medium hover:underline">
                      {(l.person as Record<string, unknown>)?.displayName as string ?? `Lead ${l.id}`}
                    </Link>
                    <div className="flex gap-2 mt-1">
                      <Badge variant="muted">{String(l.status)}</Badge>
                      <Badge variant="muted">{String(l.lifecycleStage)}</Badge>
                    </div>
                  </div>
                  <span className="text-sm text-muted-foreground">{l.primaryProductInterest as string ?? "—"}</span>
                </CardContent>
              </Card>
            ))}
            {leads.length === 0 && <p className="text-sm text-muted-foreground">No leads yet.</p>}
          </div>
        </div>
      )}

      {mode === "leadNew" && (
        <Card>
          <CardHeader><CardTitle>New lead</CardTitle></CardHeader>
          <CardContent className="space-y-3 max-w-lg">
            <Input label="First name" placeholder="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            <Input label="Last name" placeholder="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} />
            <Input label="Email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <Input label="Phone" placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
            <Input label="Product interest" placeholder="Product interest" value={productInterest} onChange={(e) => setProductInterest(e.target.value)} />
            <Button onClick={() => postAction({ action: "createLead", firstName, lastName, email, phone, primaryProductInterest: productInterest })}>
              Create lead
            </Button>
          </CardContent>
        </Card>
      )}

      {mode === "leadDetail" && lead && (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>{person?.displayName as string ?? "Lead detail"}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Badge>{String(lead.status)}</Badge>
                <Badge variant="muted">{String(lead.lifecycleStage)}</Badge>
                {lead.primaryProductInterest ? <Badge variant="muted">{String(lead.primaryProductInterest)}</Badge> : null}
              </div>
              <div>
                <h3 className="text-sm font-medium mb-2">Contact methods</h3>
                {contactMethods.map((m) => (
                  <p key={String(m.id)} className="text-sm">{String(m.methodType)}: {String(m.displayValue)}</p>
                ))}
              </div>
              {source && (
                <div>
                  <h3 className="text-sm font-medium mb-2">Source attribution</h3>
                  <p className="text-sm">Original: {String(source.originalSourceType)}</p>
                  <p className="text-sm">Latest: {String(source.latestSourceType ?? source.sourceType)}</p>
                  {source.utmCampaign ? <p className="text-sm">Campaign: {String(source.utmCampaign)}</p> : null}
                </div>
              )}
              <div>
                <h3 className="text-sm font-medium mb-2">Activity timeline</h3>
                {timeline.map((item) => (
                  <p key={String(item.id)} className="text-sm text-muted-foreground">{String(item.title)} — {new Date(String(item.occurredAt ?? item.createdAt)).toLocaleString()}</p>
                ))}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Actions</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <Button variant="outline" className="w-full" onClick={() => postAction({ action: "updateStatus", leadId, status: "CONTACTED", reason: "Manual update" })}>Mark contacted</Button>
              <Button variant="outline" className="w-full" onClick={() => postAction({ action: "updateStatus", leadId, status: "QUALIFIED", reason: "Manual qualification" })}>Mark qualified</Button>
            </CardContent>
          </Card>
        </div>
      )}

      {mode === "contacts" && (
        <div className="space-y-2">
          {contacts.map((c) => (
            <Card key={String(c.id)}>
              <CardContent className="py-4">
                <Link href={`/crm/contacts/${c.id}`} className="font-medium hover:underline">
                  {(c.person as Record<string, unknown>)?.displayName as string ?? `Contact ${c.id}`}
                </Link>
                {c.jobTitle ? <p className="text-sm text-muted-foreground">{String(c.jobTitle)}</p> : null}
              </CardContent>
            </Card>
          ))}
          {contacts.length === 0 && <p className="text-sm text-muted-foreground">No contacts yet.</p>}
        </div>
      )}

      {mode === "contactDetail" && contact && (
        <Card>
          <CardHeader><CardTitle>{(contact.person as Record<string, unknown>)?.displayName as string ?? "Contact"}</CardTitle></CardHeader>
          <CardContent>
            {contact.jobTitle ? <p className="text-sm">Title: {String(contact.jobTitle)}</p> : null}
            {contact.department ? <p className="text-sm">Department: {String(contact.department)}</p> : null}
          </CardContent>
        </Card>
      )}

      {mode === "companies" && (
        <div className="space-y-2">
          {companies.map((c) => (
            <Card key={String(c.id)}>
              <CardContent className="py-4">
                <Link href={`/crm/companies/${c.id}`} className="font-medium hover:underline">
                  {String(c.tradingName ?? c.legalName ?? c.id)}
                </Link>
                {c.industry ? <p className="text-sm text-muted-foreground">{String(c.industry)}</p> : null}
              </CardContent>
            </Card>
          ))}
          {companies.length === 0 && <p className="text-sm text-muted-foreground">No companies yet.</p>}
        </div>
      )}

      {mode === "companyDetail" && company && (
        <Card>
          <CardHeader><CardTitle>{String(company.tradingName ?? company.legalName ?? "Company")}</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {company.website ? <p className="text-sm">Website: {String(company.website)}</p> : null}
            {company.country ? <p className="text-sm">Country: {String(company.country)}</p> : null}
            {company.industry ? <p className="text-sm">Industry: {String(company.industry)}</p> : null}
          </CardContent>
        </Card>
      )}

      {mode === "duplicates" && (
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Merge preview</CardTitle></CardHeader>
            <CardContent className="space-y-2 max-w-lg">
              <Input label="Source lead ID" placeholder="Source lead ID" value={mergeSourceId} onChange={(e) => setMergeSourceId(e.target.value)} />
              <Input label="Destination lead ID" placeholder="Destination lead ID" value={mergeDestId} onChange={(e) => setMergeDestId(e.target.value)} />
              <Button variant="outline" onClick={async () => {
                if (!base || !organisationId) return;
                const res = await apiFetch<{ preview: Record<string, unknown> }>(`${base}?organisationId=${organisationId}`, {
                  method: "POST",
                  body: JSON.stringify({ action: "previewMerge", sourceLeadId: mergeSourceId, destinationLeadId: mergeDestId }),
                });
                setMergePreview(res.preview);
              }}>Preview merge</Button>
              {mergePreview && <pre className="text-xs bg-muted p-2 rounded overflow-auto">{JSON.stringify(mergePreview, null, 2)}</pre>}
              <Button onClick={() => postAction({ action: "executeMerge", sourceLeadId: mergeSourceId, destinationLeadId: mergeDestId })}>Execute merge</Button>
            </CardContent>
          </Card>
          <div className="space-y-2">
            {duplicates.map((d) => (
              <Card key={String(d.id)}>
                <CardContent className="py-4 text-sm">
                  {String(d.sourceRecordType)} {String(d.sourceRecordId)} ↔ {String(d.targetRecordId)} — {String(d.status)}
                </CardContent>
              </Card>
            ))}
            {duplicates.length === 0 && <p className="text-sm text-muted-foreground">No pending duplicate candidates.</p>}
          </div>
        </div>
      )}

      {mode === "import" && (
        <Card>
          <CardHeader><CardTitle>CSV import</CardTitle></CardHeader>
          <CardContent className="space-y-3 max-w-2xl">
            <p className="text-sm text-muted-foreground">Paste CSV with headers: name, email. Rows are sanitised against CSV injection.</p>
            <textarea
              className="w-full min-h-[160px] rounded-md border p-2 text-sm font-mono"
              value={csvRows}
              onChange={(e) => setCsvRows(e.target.value)}
              placeholder={"name,email\nAlex Smith,alex@example.com"}
            />
            <Button onClick={() => {
              const lines = csvRows.trim().split("\n");
              if (lines.length < 2) return;
              const headers = lines[0].split(",").map((h) => h.trim());
              const rows = lines.slice(1).map((line) => {
                const values = line.split(",");
                const row: Record<string, string> = {};
                headers.forEach((h, i) => { row[h] = values[i]?.trim() ?? ""; });
                return row;
              });
              postAction({ action: "importLeads", rows, mapping: { email: "email", name: "name" } });
            }}>Import leads</Button>
          </CardContent>
        </Card>
      )}

      {mode === "fields" && (
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Create custom field</CardTitle></CardHeader>
            <CardContent className="space-y-2 max-w-lg">
              <Input label="Field key" placeholder="field_key" value={fieldKey} onChange={(e) => setFieldKey(e.target.value)} />
              <Input label="Label" placeholder="Label" value={fieldLabel} onChange={(e) => setFieldLabel(e.target.value)} />
              <Input label="Field type" placeholder="Type (TEXT, NUMBER, ...)" value={fieldType} onChange={(e) => setFieldType(e.target.value)} />
              <Button onClick={() => postAction({ action: "createCustomField", fieldKey, label: fieldLabel, fieldType })}>Create field</Button>
            </CardContent>
          </Card>
          <div className="space-y-2">
            {fields.map((f) => (
              <Card key={String(f.id)}>
                <CardContent className="py-4 flex justify-between">
                  <span className="font-medium">{String(f.label)}</span>
                  <Badge variant="muted">{String(f.fieldType)}</Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
