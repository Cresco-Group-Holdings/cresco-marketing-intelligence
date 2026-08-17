"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api/client";

type Props = {
  brandId: string | null;
  organisationId: string | null;
  onCreated: () => void;
};

const OPERATION_OPTIONS = [
  { value: "SOCIAL_PUBLISH_POST", label: "Publish post" },
  { value: "SOCIAL_SCHEDULE_POST", label: "Schedule post" },
  { value: "AD_CREATE_DRAFT_CAMPAIGN", label: "Create draft campaign" },
  { value: "AD_UPDATE_BUDGET", label: "Update budget" },
];

export function PublicationComposer({ brandId, organisationId, onCreated }: Props) {
  const [contentItemId, setContentItemId] = useState("");
  const [connectionId, setConnectionId] = useState("");
  const [externalAccountId, setExternalAccountId] = useState("");
  const [operationType, setOperationType] = useState("SOCIAL_PUBLISH_POST");
  const [scheduledFor, setScheduledFor] = useState("");
  const [timezone, setTimezone] = useState("UTC");
  const [loading, setLoading] = useState(false);
  const [validation, setValidation] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate(dryRun: boolean) {
    if (!brandId || !organisationId || !contentItemId || !connectionId) {
      setError("Content item ID and connection ID are required.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result = await apiFetch<{
        publication: { id: string };
        governance: { blockers: string[]; warnings: string[] };
        adaptation: { valid: boolean; issues: Array<{ message: string }> };
      }>(`/api/brands/${brandId}/publications?organisationId=${organisationId}`, {
        method: "POST",
        organisationId,
        body: JSON.stringify({
          contentItemId,
          connectionId,
          externalAccountId,
          destinationType: "account",
          destinationId: externalAccountId,
          operationType,
          scheduledFor: scheduledFor || undefined,
          timezone,
          idempotencyKey: crypto.randomUUID(),
          dryRun,
          humanApprovalRequired: !dryRun,
        }),
      });

      setValidation({
        governance: result.governance,
        adaptation: result.adaptation,
        publicationId: result.publication.id,
      });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create publication.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Publication composer</CardTitle>
        <CardDescription>Create a governed outbound operation with validation and approval.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <label className="block text-sm">
          <span className="text-muted-foreground">Content item ID</span>
          <input
            className="mt-1 w-full rounded-md border px-3 py-2"
            value={contentItemId}
            onChange={(event) => setContentItemId(event.target.value)}
            placeholder="Content item ID"
          />
        </label>
        <label className="block text-sm">
          <span className="text-muted-foreground">Connection ID</span>
          <input
            className="mt-1 w-full rounded-md border px-3 py-2"
            value={connectionId}
            onChange={(event) => setConnectionId(event.target.value)}
            placeholder="Provider connection ID"
          />
        </label>
        <label className="block text-sm">
          <span className="text-muted-foreground">External account ID</span>
          <input
            className="mt-1 w-full rounded-md border px-3 py-2"
            value={externalAccountId}
            onChange={(event) => setExternalAccountId(event.target.value)}
          />
        </label>
        <label className="block text-sm">
          <span className="text-muted-foreground">Operation</span>
          <select
            className="mt-1 w-full rounded-md border px-3 py-2"
            value={operationType}
            onChange={(event) => setOperationType(event.target.value)}
          >
            {OPERATION_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-muted-foreground">Schedule for (optional)</span>
          <input
            type="datetime-local"
            className="mt-1 w-full rounded-md border px-3 py-2"
            value={scheduledFor}
            onChange={(event) => setScheduledFor(event.target.value)}
          />
        </label>
        <label className="block text-sm">
          <span className="text-muted-foreground">Timezone</span>
          <input
            className="mt-1 w-full rounded-md border px-3 py-2"
            value={timezone}
            onChange={(event) => setTimezone(event.target.value)}
          />
        </label>

        {error ? <p className="text-sm text-red-700">{error}</p> : null}

        {validation ? (
          <div className="rounded-md bg-muted p-3 text-xs">
            <p className="font-medium">Validation result</p>
            <pre className="mt-1 overflow-auto whitespace-pre-wrap">{JSON.stringify(validation, null, 2)}</pre>
          </div>
        ) : null}

        <div className="flex gap-2">
          <Button size="sm" variant="outline" disabled={loading || !brandId} onClick={() => void handleCreate(true)}>
            Dry-run validate
          </Button>
          <Button size="sm" disabled={loading || !brandId} onClick={() => void handleCreate(false)}>
            Request publication
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
