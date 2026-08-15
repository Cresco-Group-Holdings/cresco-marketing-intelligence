"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { apiFetch } from "@/lib/api/client";
import { APPROVAL_TYPE_LABELS } from "@/lib/tasks/constants";

type ApprovalItem = {
  id: string;
  type: string;
  status: string;
  title: string;
  description: string | null;
  entityType: string;
  entityId: string;
  requester: { id: string; displayName: string | null; email: string };
  createdAt: string;
  decisions: Array<{
    id: string;
    decision: string;
    feedback: string | null;
    decider: { id: string; displayName: string | null; email: string };
    decidedAt: string;
  }>;
};

export function ApprovalInboxView() {
  const { preference } = useWorkspace();
  const [items, setItems] = useState<ApprovalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const organisationId = preference.currentOrganisationId;
  const brandId = preference.currentBrandId;

  const loadInbox = useCallback(async () => {
    if (!organisationId || !brandId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<{ items: ApprovalItem[] }>(
        `/api/brands/${brandId}/approvals/inbox?organisationId=${organisationId}`,
        { organisationId },
      );
      setItems(data.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load approvals.");
    } finally {
      setLoading(false);
    }
  }, [organisationId, brandId]);

  useEffect(() => {
    void loadInbox();
  }, [loadInbox]);

  async function decide(approvalId: string, decision: "APPROVED" | "REJECTED" | "CHANGES_REQUESTED") {
    if (!organisationId || !brandId) return;
    const feedback =
      decision !== "APPROVED" ? window.prompt("Optional feedback:") ?? undefined : undefined;
    await apiFetch(
      `/api/brands/${brandId}/approvals/${approvalId}?organisationId=${organisationId}`,
      { method: "POST", organisationId, body: JSON.stringify({ decision, feedback }) },
    );
    await loadInbox();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Approval inbox"
        description="Review and decide on pending approval requests across the platform."
      />

      {loading && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">Loading…</CardContent>
        </Card>
      )}

      {error && (
        <Card>
          <CardContent className="py-8 text-center text-destructive">{error}</CardContent>
        </Card>
      )}

      {!loading && !error && items.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No pending approvals.
          </CardContent>
        </Card>
      )}

      {!loading && !error && items.length > 0 && (
        <div className="space-y-4">
          {items.map((item) => (
            <Card key={item.id}>
              <CardHeader className="flex flex-row items-start justify-between">
                <div>
                  <CardTitle className="text-base">{item.title}</CardTitle>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Badge>
                      {APPROVAL_TYPE_LABELS[item.type as keyof typeof APPROVAL_TYPE_LABELS] ??
                        item.type}
                    </Badge>
                    <Badge variant="muted">{item.status}</Badge>
                  </div>
                </div>
                <span className="text-xs text-muted-foreground">
                  {new Date(item.createdAt).toLocaleString()}
                </span>
              </CardHeader>
              <CardContent className="space-y-3">
                {item.description && (
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  Entity: {item.entityType} / {item.entityId}
                </p>
                <p className="text-xs text-muted-foreground">
                  Requested by {item.requester.displayName ?? item.requester.email}
                </p>

                {item.decisions.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium">Decision history</p>
                    {item.decisions.map((d) => (
                      <div key={d.id} className="rounded border p-2 text-xs">
                        <span className="font-medium">{d.decision}</span> by{" "}
                        {d.decider.displayName ?? d.decider.email}
                        {d.feedback && <p className="mt-1 text-muted-foreground">{d.feedback}</p>}
                      </div>
                    ))}
                  </div>
                )}

                {item.status === "PENDING" && (
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => void decide(item.id, "APPROVED")}>
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void decide(item.id, "CHANGES_REQUESTED")}
                    >
                      Request changes
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void decide(item.id, "REJECTED")}
                    >
                      Reject
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
