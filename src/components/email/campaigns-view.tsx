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

export type CampaignsViewMode =
  | "list"
  | "new"
  | "detail"
  | "audience"
  | "content"
  | "review"
  | "analytics";

type Props = { mode: CampaignsViewMode; campaignId?: string };

export function CampaignsView({ mode, campaignId }: Props) {
  const { preference } = useWorkspace();
  const brandId = preference.currentBrandId;
  const organisationId = preference.currentOrganisationId;
  const base = brandId ? `/api/brands/${brandId}/email/campaigns` : null;

  const [campaigns, setCampaigns] = useState<Array<Record<string, unknown>>>([]);
  const [campaign, setCampaign] = useState<Record<string, unknown> | null>(null);
  const [analytics, setAnalytics] = useState<Record<string, unknown> | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [name, setName] = useState("");
  const [campaignType, setCampaignType] = useState("NEWSLETTER");
  const [objective, setObjective] = useState("");
  const [subject, setSubject] = useState("");
  const [htmlBody, setHtmlBody] = useState("<p>Hello {{firstName}}</p>");
  const [senderId, setSenderId] = useState("");
  const [unsubscribeLink, setUnsubscribeLink] = useState("https://example.com/unsubscribe");
  const [memberEmail, setMemberEmail] = useState("");

  const loadData = useCallback(async () => {
    if (!base || !organisationId) return;
    setLoading(true);
    try {
      if (mode === "list" || mode === "new") {
        const res = await apiFetch<{ campaigns: Array<Record<string, unknown>> }>(`${base}?organisationId=${organisationId}`);
        setCampaigns(res.campaigns);
      } else if (campaignId) {
        const res = await apiFetch<{ campaign: Record<string, unknown> }>(`${base}?organisationId=${organisationId}&campaignId=${campaignId}`);
        setCampaign(res.campaign);
        if (mode === "analytics") {
          const aRes = await apiFetch<{ analytics: Record<string, unknown> }>(`${base}?organisationId=${organisationId}&campaignId=${campaignId}&view=analytics`);
          setAnalytics(aRes.analytics);
        }
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Failed to load.");
    } finally {
      setLoading(false);
    }
  }, [base, organisationId, mode, campaignId]);

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

  const nav = campaignId ? (
    <nav className="flex flex-wrap gap-2 border-b pb-3 mb-6">
      <Link href={`/email/campaigns/${campaignId}`} className={`rounded-md px-3 py-1.5 text-sm ${mode === "detail" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>Overview</Link>
      <Link href={`/email/campaigns/${campaignId}/audience`} className={`rounded-md px-3 py-1.5 text-sm ${mode === "audience" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>Audience</Link>
      <Link href={`/email/campaigns/${campaignId}/content`} className={`rounded-md px-3 py-1.5 text-sm ${mode === "content" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>Content</Link>
      <Link href={`/email/campaigns/${campaignId}/review`} className={`rounded-md px-3 py-1.5 text-sm ${mode === "review" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>Review</Link>
      <Link href={`/email/campaigns/${campaignId}/analytics`} className={`rounded-md px-3 py-1.5 text-sm ${mode === "analytics" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>Analytics</Link>
    </nav>
  ) : (
    <nav className="flex flex-wrap gap-2 border-b pb-3 mb-6">
      <Link href="/email/campaigns" className={`rounded-md px-3 py-1.5 text-sm ${mode === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>All campaigns</Link>
      <Link href="/email/campaigns/new" className={`rounded-md px-3 py-1.5 text-sm ${mode === "new" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>New campaign</Link>
      <Link href="/email" className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted">Email hub</Link>
    </nav>
  );

  const audience = (campaign?.audiences as Array<Record<string, unknown>>)?.[0];
  const content = (campaign?.contents as Array<Record<string, unknown>>)?.[0];

  return (
    <div className="space-y-6">
      <PageHeader title="Email Campaigns" description="One-time campaigns and newsletters with approval and recipient snapshots." />
      {nav}
      {message && <p className="text-sm text-muted-foreground">{message}</p>}
      {loading && <p className="text-sm text-muted-foreground">Loading…</p>}

      {mode === "list" && (
        <div className="space-y-4">
          <Link href="/email/campaigns/new"><Button>New campaign</Button></Link>
          {campaigns.map((c) => (
            <Card key={String(c.id)}>
              <CardContent className="py-4 flex justify-between">
                <Link href={`/email/campaigns/${c.id}`} className="font-medium hover:underline">{String(c.name)}</Link>
                <div className="flex gap-2">
                  <Badge variant="muted">{String(c.campaignType)}</Badge>
                  <Badge>{String(c.status)}</Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {mode === "new" && (
        <Card>
          <CardHeader><CardTitle>Create campaign</CardTitle></CardHeader>
          <CardContent className="space-y-3 max-w-lg">
            <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} />
            <Input label="Type" value={campaignType} onChange={(e) => setCampaignType(e.target.value)} placeholder="NEWSLETTER" />
            <Input label="Objective" value={objective} onChange={(e) => setObjective(e.target.value)} />
            <Button onClick={async () => {
              const res = await apiFetch<{ campaign: { id: string } }>(`${base}?organisationId=${organisationId}`, {
                method: "POST",
                body: JSON.stringify({ action: "createCampaign", name, campaignType, objective }),
              });
              window.location.href = `/email/campaigns/${res.campaign.id}`;
            }}>Create</Button>
          </CardContent>
        </Card>
      )}

      {mode === "detail" && campaign && (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader><CardTitle>{String(campaign.name)}</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <Badge>{String(campaign.status)}</Badge>
              {campaign.objective ? <p className="text-sm">{String(campaign.objective)}</p> : null}
              {audience ? <p className="text-sm">Sendable: {String(audience.finalSendableCount)}</p> : null}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Actions</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <Button variant="outline" className="w-full" onClick={() => postAction({ action: "runReadinessChecks", campaignId })}>Run readiness checks</Button>
              <Button variant="outline" className="w-full" onClick={() => postAction({ action: "launchCampaign", campaignId })}>Launch</Button>
              <Button variant="outline" className="w-full" onClick={() => postAction({ action: "emergencyStop", campaignId })}>Emergency stop</Button>
            </CardContent>
          </Card>
        </div>
      )}

      {mode === "audience" && campaignId && (
        <Card>
          <CardHeader><CardTitle>Audience</CardTitle></CardHeader>
          <CardContent className="space-y-3 max-w-lg">
            {audience && (
              <div className="text-sm space-y-1">
                <p>Total: {String(audience.totalMembers)}</p>
                <p>Consent eligible: {String(audience.consentEligible)}</p>
                <p>Suppressed: {String(audience.suppressedCount)}</p>
                <p>Final sendable: {String(audience.finalSendableCount)}</p>
              </div>
            )}
            <Input label="Member email" value={memberEmail} onChange={(e) => setMemberEmail(e.target.value)} />
            <Button onClick={() => postAction({
              action: "setAudience",
              campaignId,
              members: [{ emailAddress: memberEmail, consentMarketing: true }],
            })}>Set audience</Button>
            <Button variant="outline" onClick={() => postAction({
              action: "createSnapshot",
              campaignId,
              members: [{ emailAddress: memberEmail, consentMarketing: true }],
            })}>Create recipient snapshot</Button>
          </CardContent>
        </Card>
      )}

      {mode === "content" && campaignId && (
        <Card>
          <CardHeader><CardTitle>Content</CardTitle></CardHeader>
          <CardContent className="space-y-3 max-w-lg">
            <Input label="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
            <Input label="Sender ID" value={senderId} onChange={(e) => setSenderId(e.target.value)} />
            <Input label="HTML body" value={htmlBody} onChange={(e) => setHtmlBody(e.target.value)} />
            <Input label="Unsubscribe link" value={unsubscribeLink} onChange={(e) => setUnsubscribeLink(e.target.value)} />
            <Button onClick={() => postAction({
              action: "setContent",
              campaignId,
              subject,
              htmlBody,
              senderIdentityId: senderId || undefined,
              unsubscribeLink,
              complianceFooter: "Company Ltd, 1 Example St",
            })}>Save content</Button>
            <Button variant="outline" onClick={() => postAction({ action: "generateAiDraft", campaignId, userInstructions: objective })}>AI draft</Button>
          </CardContent>
        </Card>
      )}

      {mode === "review" && campaignId && (
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Approvals</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {["AUDIENCE", "CONTENT", "COMPLIANCE", "SCHEDULE", "FINAL_SEND"].map((type) => (
                <Button key={type} variant="outline" className="w-full" onClick={() => postAction({ action: "grantApproval", campaignId, approvalType: type })}>
                  Approve {type.replace("_", " ").toLowerCase()}
                </Button>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Schedule</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <Button className="w-full" onClick={() => postAction({ action: "setSchedule", campaignId, sendNow: true })}>Send now</Button>
              <Button variant="outline" className="w-full" onClick={() => postAction({ action: "cancelCampaign", campaignId })}>Cancel</Button>
            </CardContent>
          </Card>
        </div>
      )}

      {mode === "analytics" && analytics && (
        <Card>
          <CardHeader><CardTitle>Campaign analytics</CardTitle></CardHeader>
          <CardContent>
            {analytics.metrics ? (
              <div className="grid gap-4 md:grid-cols-4 text-sm">
                <div>Attempted: {String((analytics.metrics as Record<string, unknown>).attempted)}</div>
                <div>Sent: {String((analytics.metrics as Record<string, unknown>).sent)}</div>
                <div>Delivered: {String((analytics.metrics as Record<string, unknown>).delivered)}</div>
                <div>Bounced: {String((analytics.metrics as Record<string, unknown>).bounced)}</div>
              </div>
            ) : <p className="text-sm text-muted-foreground">No metrics yet.</p>}
            {analytics.limitations ? (
              <p className="text-xs text-muted-foreground mt-4">Open and click metrics have known limitations.</p>
            ) : null}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
