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

export type EmailViewMode =
  | "overview"
  | "providers"
  | "domains"
  | "senders"
  | "templates"
  | "messages"
  | "suppressions"
  | "deliverability";

type Props = { mode: EmailViewMode };

export function EmailView({ mode }: Props) {
  const { preference } = useWorkspace();
  const brandId = preference.currentBrandId;
  const organisationId = preference.currentOrganisationId;
  const base = brandId ? `/api/brands/${brandId}/email` : null;

  const [providers, setProviders] = useState<Array<Record<string, unknown>>>([]);
  const [domains, setDomains] = useState<Array<Record<string, unknown>>>([]);
  const [senders, setSenders] = useState<Array<Record<string, unknown>>>([]);
  const [templates, setTemplates] = useState<Array<Record<string, unknown>>>([]);
  const [messages, setMessages] = useState<Array<Record<string, unknown>>>([]);
  const [suppressions, setSuppressions] = useState<Array<Record<string, unknown>>>([]);
  const [deliverability, setDeliverability] = useState<Record<string, unknown> | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [providerName, setProviderName] = useState("");
  const [providerType, setProviderType] = useState("RESEND");
  const [domainName, setDomainName] = useState("");
  const [providerId, setProviderId] = useState("");
  const [senderName, setSenderName] = useState("");
  const [senderEmail, setSenderEmail] = useState("");
  const [domainId, setDomainId] = useState("");
  const [templateName, setTemplateName] = useState("");
  const [templateSlug, setTemplateSlug] = useState("");
  const [templateSubject, setTemplateSubject] = useState("");
  const [templateHtml, setTemplateHtml] = useState("<p>Hello {{firstName}}</p>");
  const [suppressEmail, setSuppressEmail] = useState("");

  const loadData = useCallback(async () => {
    if (!base || !organisationId) return;
    setLoading(true);
    try {
      if (mode === "overview") {
        const res = await apiFetch<Record<string, unknown>>(`${base}?organisationId=${organisationId}`);
        setProviders((res.providers as Array<Record<string, unknown>>) ?? []);
        setDomains((res.domains as Array<Record<string, unknown>>) ?? []);
        setSenders((res.senders as Array<Record<string, unknown>>) ?? []);
        setTemplates((res.templates as Array<Record<string, unknown>>) ?? []);
        setMessages((res.messages as Array<Record<string, unknown>>) ?? []);
      } else {
        const res = await apiFetch<Record<string, unknown>>(`${base}?organisationId=${organisationId}&view=${mode}`);
        if (mode === "providers") setProviders((res.providers as Array<Record<string, unknown>>) ?? []);
        if (mode === "domains") setDomains((res.domains as Array<Record<string, unknown>>) ?? []);
        if (mode === "senders") setSenders((res.senders as Array<Record<string, unknown>>) ?? []);
        if (mode === "templates") setTemplates((res.templates as Array<Record<string, unknown>>) ?? []);
        if (mode === "messages") setMessages((res.messages as Array<Record<string, unknown>>) ?? []);
        if (mode === "suppressions") setSuppressions((res.suppressions as Array<Record<string, unknown>>) ?? []);
        if (mode === "deliverability") setDeliverability(res);
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Failed to load data.");
    } finally {
      setLoading(false);
    }
  }, [base, organisationId, mode]);

  useEffect(() => { loadData(); }, [loadData]);

  async function postAction(body: Record<string, unknown>) {
    if (!base || !organisationId) return;
    setLoading(true);
    setMessage(null);
    try {
      await apiFetch(`${base}?organisationId=${organisationId}`, { method: "POST", body: JSON.stringify(body) });
      setMessage("Action completed.");
      await loadData();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Action failed.");
    } finally {
      setLoading(false);
    }
  }

  const nav = (
    <nav className="flex flex-wrap gap-2 border-b pb-3 mb-6">
      {[
        { mode: "overview" as const, label: "Overview", href: "/email" },
        { mode: "providers" as const, label: "Providers", href: "/email/providers" },
        { mode: "domains" as const, label: "Domains", href: "/email/domains" },
        { mode: "senders" as const, label: "Senders", href: "/email/senders" },
        { mode: "templates" as const, label: "Templates", href: "/email/templates" },
        { mode: "messages" as const, label: "Messages", href: "/email/messages" },
        { mode: "suppressions" as const, label: "Suppressions", href: "/email/suppressions" },
        { mode: "deliverability" as const, label: "Deliverability", href: "/email/deliverability" },
      ].map((tab) => (
        <Link key={tab.href} href={tab.href} className={`rounded-md px-3 py-1.5 text-sm ${mode === tab.mode ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>
          {tab.label}
        </Link>
      ))}
      <Link href="/email/campaigns" className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted">Campaigns</Link>
    </nav>
  );

  return (
    <div className="space-y-6">
      <PageHeader title="Email Infrastructure" description="Provider-independent sending, deliverability controls, and suppression." />
      {nav}
      {message && <p className="text-sm text-muted-foreground">{message}</p>}
      {loading && <p className="text-sm text-muted-foreground">Loading…</p>}

      {mode === "overview" && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card><CardHeader><CardTitle className="text-sm">Providers</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{providers.length}</CardContent></Card>
          <Card><CardHeader><CardTitle className="text-sm">Domains ready</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{domains.filter((d) => d.sendingStatus === "READY").length}</CardContent></Card>
          <Card><CardHeader><CardTitle className="text-sm">Templates</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{templates.length}</CardContent></Card>
        </div>
      )}

      {mode === "providers" && (
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Add provider</CardTitle></CardHeader>
            <CardContent className="space-y-3 max-w-lg">
              <Input label="Name" value={providerName} onChange={(e) => setProviderName(e.target.value)} />
              <Input label="Type" value={providerType} onChange={(e) => setProviderType(e.target.value)} placeholder="RESEND, SENDGRID, AMAZON_SES" />
              <Button onClick={() => postAction({ action: "createProvider", name: providerName, providerType })}>Add provider</Button>
            </CardContent>
          </Card>
          {providers.map((p) => (
            <Card key={String(p.id)}><CardContent className="py-4 flex justify-between"><span>{String(p.name)}</span><Badge>{String(p.providerType)}</Badge></CardContent></Card>
          ))}
        </div>
      )}

      {mode === "domains" && (
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Add domain</CardTitle></CardHeader>
            <CardContent className="space-y-3 max-w-lg">
              <Input label="Domain" value={domainName} onChange={(e) => setDomainName(e.target.value)} placeholder="mail.example.com" />
              <Input label="Provider ID" value={providerId} onChange={(e) => setProviderId(e.target.value)} />
              <Button onClick={() => postAction({ action: "addDomain", domain: domainName, providerConnectionId: providerId })}>Add domain</Button>
            </CardContent>
          </Card>
          {domains.map((d) => (
            <Card key={String(d.id)}>
              <CardContent className="py-4 flex justify-between items-center">
                <div>
                  <p className="font-medium">{String(d.domain)}</p>
                  <p className="text-sm text-muted-foreground">SPF: {String(d.spfStatus)} · DKIM: {String(d.dkimStatus)}</p>
                </div>
                <div className="flex gap-2">
                  <Badge>{String(d.sendingStatus)}</Badge>
                  <Button size="sm" variant="outline" onClick={() => postAction({ action: "checkDomain", domainId: d.id })}>Verify</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {mode === "senders" && (
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Add sender</CardTitle></CardHeader>
            <CardContent className="space-y-3 max-w-lg">
              <Input label="Display name" value={senderName} onChange={(e) => setSenderName(e.target.value)} />
              <Input label="Email" value={senderEmail} onChange={(e) => setSenderEmail(e.target.value)} />
              <Input label="Domain ID" value={domainId} onChange={(e) => setDomainId(e.target.value)} />
              <Button onClick={() => postAction({ action: "createSender", displayName: senderName, emailAddress: senderEmail, domainId })}>Add sender</Button>
            </CardContent>
          </Card>
          {senders.map((s) => (
            <Card key={String(s.id)}><CardContent className="py-4 flex justify-between"><span>{String(s.displayName)} &lt;{String(s.emailAddress)}&gt;</span><Badge>{String(s.verificationStatus)}</Badge></CardContent></Card>
          ))}
        </div>
      )}

      {mode === "templates" && (
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Create template</CardTitle></CardHeader>
            <CardContent className="space-y-3 max-w-lg">
              <Input label="Name" value={templateName} onChange={(e) => setTemplateName(e.target.value)} />
              <Input label="Slug" value={templateSlug} onChange={(e) => setTemplateSlug(e.target.value)} />
              <Input label="Subject" value={templateSubject} onChange={(e) => setTemplateSubject(e.target.value)} />
              <Input label="HTML" value={templateHtml} onChange={(e) => setTemplateHtml(e.target.value)} />
              <Button onClick={() => postAction({ action: "createTemplate", name: templateName, slug: templateSlug, category: "MARKETING", subject: templateSubject, htmlBody: templateHtml, requiresUnsubscribe: true, complianceFooter: "Unsubscribe link required" })}>Create template</Button>
            </CardContent>
          </Card>
          {templates.map((t) => (
            <Card key={String(t.id)}><CardContent className="py-4 flex justify-between"><span>{String(t.name)}</span><Badge>{String(t.category)}</Badge></CardContent></Card>
          ))}
        </div>
      )}

      {mode === "messages" && (
        <div className="space-y-2">
          {messages.map((m) => (
            <Card key={String(m.id)}>
              <CardContent className="py-4 flex justify-between">
                <span>{String(m.subject)}</span>
                <Badge>{String(m.status)}</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {mode === "suppressions" && (
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Add suppression</CardTitle></CardHeader>
            <CardContent className="space-y-3 max-w-lg">
              <Input label="Email" value={suppressEmail} onChange={(e) => setSuppressEmail(e.target.value)} />
              <Button onClick={() => postAction({ action: "addSuppression", emailAddress: suppressEmail, reason: "MANUAL" })}>Suppress</Button>
            </CardContent>
          </Card>
          {suppressions.map((s) => (
            <Card key={String(s.id)}><CardContent className="py-4 flex justify-between"><span>{String(s.emailAddress)}</span><Badge>{String(s.reason)}</Badge></CardContent></Card>
          ))}
        </div>
      )}

      {mode === "deliverability" && deliverability && (
        <div className="space-y-4">
          {((deliverability.warnings as Array<Record<string, unknown>>) ?? []).map((w, i) => (
            <Card key={i}><CardContent className="py-3 flex justify-between text-sm"><span>{String(w.message)}</span><Badge>{String(w.severity)}</Badge></CardContent></Card>
          ))}
          {deliverability.shutdownRecommended ? <p className="text-sm text-destructive">Sending shutdown recommended due to critical deliverability thresholds.</p> : null}
          <Card>
            <CardHeader><CardTitle>30-day snapshot</CardTitle></CardHeader>
            <CardContent>
              {deliverability.snapshot ? (
                <p className="text-sm">Sent: {String((deliverability.snapshot as Record<string, unknown>).sentCount)} · Bounces: {String((deliverability.snapshot as Record<string, unknown>).bounceCount)} · Complaints: {String((deliverability.snapshot as Record<string, unknown>).complaintCount)}</p>
              ) : null}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
