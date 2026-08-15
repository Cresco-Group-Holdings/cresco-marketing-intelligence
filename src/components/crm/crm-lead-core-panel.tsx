"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api/client";
import { getAllowedNextStatuses } from "@/lib/crm/lead-workflow";

type Props = {
  brandId: string;
  organisationId: string;
  leadId: string;
  currentStatus: string;
  onUpdated?: () => void;
};

export function CrmLeadCorePanel({ brandId, organisationId, leadId, currentStatus, onUpdated }: Props) {
  const base = `/api/brands/${brandId}/crm/core?organisationId=${organisationId}`;
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [core, setCore] = useState<Record<string, unknown> | null>(null);
  const [consentChannel, setConsentChannel] = useState("EMAIL");
  const [manualScore, setManualScore] = useState("50");
  const [qualNotes, setQualNotes] = useState("");

  const loadCore = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{ lead: Record<string, unknown> }>(`${base}&leadId=${leadId}`);
      setCore(res.lead);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Failed to load lead core data.");
    } finally {
      setLoading(false);
    }
  }, [base, leadId]);

  useEffect(() => {
    loadCore();
  }, [loadCore]);

  async function postAction(body: Record<string, unknown>) {
    setLoading(true);
    setMessage(null);
    try {
      await apiFetch(base, { method: "POST", body: JSON.stringify(body) });
      setMessage("Saved.");
      await loadCore();
      onUpdated?.();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Action failed.");
    } finally {
      setLoading(false);
    }
  }

  const nextStatuses = getAllowedNextStatuses(currentStatus);
  const assessments = (core?.qualificationAssessments as Array<Record<string, unknown>>) ?? [];
  const consents = (core?.consentRecords as Array<Record<string, unknown>>) ?? [];
  const scores = (core?.manualScores as Array<Record<string, unknown>>) ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Qualification & consent</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {message && <p className="text-sm text-muted-foreground">{message}</p>}
        {loading && <p className="text-sm text-muted-foreground">Loading…</p>}

        <div>
          <h3 className="text-sm font-medium mb-2">Workflow</h3>
          <div className="flex flex-wrap gap-2">
            {nextStatuses.map((status) => (
              <Button
                key={status}
                variant="outline"
                size="sm"
                onClick={() => postAction({ action: "transitionLead", leadId, status, reason: "Workflow action" })}
              >
                → {status}
              </Button>
            ))}
            {nextStatuses.length === 0 && (
              <Badge variant="muted">Terminal status</Badge>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-medium">Manual qualification</h3>
          <Input
            label="Notes"
            value={qualNotes}
            onChange={(e) => setQualNotes(e.target.value)}
            placeholder="Assessment notes"
          />
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                postAction({
                  action: "recordQualification",
                  leadId,
                  outcome: "QUALIFIED",
                  notes: qualNotes,
                  criteria: { manual: true },
                })
              }
            >
              Mark qualified
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                postAction({
                  action: "recordQualification",
                  leadId,
                  outcome: "DISQUALIFIED",
                  notes: qualNotes,
                })
              }
            >
              Disqualify
            </Button>
          </div>
          {assessments.slice(0, 3).map((a) => (
            <p key={String(a.id)} className="text-xs text-muted-foreground">
              {String(a.outcome)} — {new Date(String(a.assessedAt)).toLocaleString()}
            </p>
          ))}
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-medium">Consent</h3>
          <Input label="Channel" value={consentChannel} onChange={(e) => setConsentChannel(e.target.value)} />
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                postAction({
                  action: "recordConsent",
                  leadId,
                  channel: consentChannel,
                  status: "GRANTED",
                  marketingOptIn: true,
                  lawfulBasis: "CONSENT",
                })
              }
            >
              Grant consent
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                postAction({
                  action: "recordConsent",
                  leadId,
                  channel: consentChannel,
                  status: "WITHDRAWN",
                  marketingOptIn: false,
                  suppressed: true,
                })
              }
            >
              Withdraw / suppress
            </Button>
          </div>
          {consents.slice(0, 3).map((c) => (
            <p key={String(c.id)} className="text-xs text-muted-foreground">
              {String(c.channel)}: {String(c.status)}
            </p>
          ))}
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-medium">Manual score</h3>
          <Input label="Score" value={manualScore} onChange={(e) => setManualScore(e.target.value)} />
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              postAction({
                action: "recordManualScore",
                leadId,
                score: Number(manualScore),
                rationale: "Manual score",
              })
            }
          >
            Save score
          </Button>
          {scores[0] && (
            <p className="text-xs text-muted-foreground">
              Current: {String(scores[0].score)}/{String(scores[0].maxScore)}
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-2 pt-2 border-t">
          <Button
            variant="outline"
            size="sm"
            onClick={() => postAction({ action: "exportLead", leadId, scope: "FULL" })}
          >
            Export data
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => postAction({ action: "archiveLead", leadId, reason: "Manual archive" })}
          >
            Archive
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => postAction({ action: "prepareAnonymisation", leadId })}
          >
            Request anonymisation
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
