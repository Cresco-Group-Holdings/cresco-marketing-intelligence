"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api/client";
import { validateChannelVariant } from "@/lib/organic-growth/validation";
import type { OrganicAccountRow } from "@/lib/organic-growth/types";

type ContentOption = {
  id: string;
  title: string;
  status: string;
  format: string | null;
};

type AccountOption = {
  connectionId: string;
  externalAccountId: string;
  label: string;
  provider: string;
};

type Props = {
  brandId: string | null;
  organisationId: string | null;
  accounts: OrganicAccountRow[];
  onCreated: () => void;
};

export function PublicationComposerV2({ brandId, organisationId, accounts, onCreated }: Props) {
  const [contentItems, setContentItems] = useState<ContentOption[]>([]);
  const [accountOptions, setAccountOptions] = useState<AccountOption[]>([]);
  const [contentItemId, setContentItemId] = useState("");
  const [accountKey, setAccountKey] = useState("");
  const [scheduledFor, setScheduledFor] = useState("");
  const [timezone, setTimezone] = useState("UTC");
  const [publishNow, setPublishNow] = useState(true);
  const [loading, setLoading] = useState(false);
  const [validationIssues, setValidationIssues] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const loadOptions = useCallback(async () => {
    if (!brandId || !organisationId) return;
    try {
      const [studio, connections] = await Promise.all([
        apiFetch<{ items: Array<{ id: string; title: string; status: string; contentType: string }> }>(
          `/api/brands/${brandId}/content-studio?organisationId=${organisationId}`,
        ),
        apiFetch<{
          catalogue: Array<{
            provider: string;
            connection?: { id: string; status: string } | null;
            accounts?: Array<{ id: string; displayName: string; externalAccountId: string }>;
          }>;
        }>(`/api/brands/${brandId}/social/connections?organisationId=${organisationId}`),
      ]);

      setContentItems(
        studio.items
          .filter((item) => ["APPROVED", "READY", "SCHEDULED"].includes(item.status))
          .map((item) => ({
            id: item.id,
            title: item.title,
            status: item.status,
            format: item.contentType,
          })),
      );

      const options: AccountOption[] = [];
      for (const entry of connections.catalogue) {
        if (!entry.connection?.id || entry.connection.status !== "CONNECTED") continue;
        for (const account of entry.accounts ?? []) {
          options.push({
            connectionId: entry.connection.id,
            externalAccountId: account.externalAccountId,
            label: `${entry.provider} — ${account.displayName}`,
            provider: entry.provider,
          });
        }
      }
      setAccountOptions(options);
    } catch {
      setContentItems([]);
      setAccountOptions([]);
    }
  }, [brandId, organisationId]);

  useEffect(() => {
    void loadOptions();
  }, [loadOptions]);

  const selectedContent = contentItems.find((item) => item.id === contentItemId);
  const selectedAccount = accountOptions.find(
    (item) => `${item.connectionId}:${item.externalAccountId}` === accountKey,
  );

  function runValidation(): string[] {
    if (!selectedContent || !selectedAccount) {
      return ["Select approved content and a connected account."];
    }
    const issues = validateChannelVariant({
      provider: selectedAccount.provider,
      format: selectedContent.format ?? "TEXT_POST",
      copy: selectedContent.title,
      hasMedia: false,
      accountConnected: true,
    });
    return issues.map((issue) => issue.message);
  }

  async function handleSubmit(dryRun: boolean) {
    if (!brandId || !organisationId || !selectedContent || !selectedAccount) {
      setError("Select content and a connected account to continue.");
      return;
    }

    const issues = runValidation();
    setValidationIssues(issues);
    if (issues.length > 0 && !dryRun) {
      setError("Resolve validation issues before publishing.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await apiFetch(`/api/brands/${brandId}/publications?organisationId=${organisationId}`, {
        method: "POST",
        organisationId,
        body: JSON.stringify({
          contentItemId: selectedContent.id,
          connectionId: selectedAccount.connectionId,
          externalAccountId: selectedAccount.externalAccountId,
          destinationType: "account",
          destinationId: selectedAccount.externalAccountId,
          operationType: publishNow ? "SOCIAL_PUBLISH_POST" : "SOCIAL_SCHEDULE_POST",
          scheduledFor: publishNow ? undefined : scheduledFor || undefined,
          timezone,
          idempotencyKey: crypto.randomUUID(),
          dryRun,
          humanApprovalRequired: !dryRun,
        }),
      });
      onCreated();
      setContentItemId("");
      setAccountKey("");
      setScheduledFor("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create publication.");
    } finally {
      setLoading(false);
    }
  }

  if (!brandId || !organisationId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Publication composer</CardTitle>
          <CardDescription>Select a brand workspace to compose publications.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Publication composer</CardTitle>
        <CardDescription>
          Select approved content and a connected account. Internal IDs are resolved automatically.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <label className="block text-sm">
          <span className="text-foreground-muted">Content</span>
          <select
            className="mt-1 w-full rounded-md border border-border bg-surface-elevated px-3 py-2 text-sm"
            value={contentItemId}
            onChange={(event) => setContentItemId(event.target.value)}
          >
            <option value="">Select approved content</option>
            {contentItems.map((item) => (
              <option key={item.id} value={item.id}>
                {item.title} ({item.status})
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm">
          <span className="text-foreground-muted">Publish to account</span>
          <select
            className="mt-1 w-full rounded-md border border-border bg-surface-elevated px-3 py-2 text-sm"
            value={accountKey}
            onChange={(event) => setAccountKey(event.target.value)}
          >
            <option value="">Select connected account</option>
            {accountOptions.map((item) => (
              <option
                key={`${item.connectionId}:${item.externalAccountId}`}
                value={`${item.connectionId}:${item.externalAccountId}`}
              >
                {item.label}
              </option>
            ))}
          </select>
        </label>

        {accountOptions.length === 0 && accounts.length > 0 ? (
          <p className="text-xs text-warning">
            Connected accounts may need re-authentication before publishing.
          </p>
        ) : null}

        <fieldset className="space-y-2 text-sm">
          <legend className="text-foreground-muted">Timing</legend>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              checked={publishNow}
              onChange={() => setPublishNow(true)}
            />
            Publish now
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              checked={!publishNow}
              onChange={() => setPublishNow(false)}
            />
            Schedule
          </label>
          {!publishNow ? (
            <input
              type="datetime-local"
              className="w-full rounded-md border border-border px-3 py-2"
              value={scheduledFor}
              onChange={(event) => setScheduledFor(event.target.value)}
            />
          ) : null}
        </fieldset>

        <label className="block text-sm">
          <span className="text-foreground-muted">Timezone</span>
          <input
            className="mt-1 w-full rounded-md border border-border px-3 py-2"
            value={timezone}
            onChange={(event) => setTimezone(event.target.value)}
          />
        </label>

        {validationIssues.length > 0 ? (
          <ul className="space-y-1 rounded-md border border-warning/30 bg-warning-muted/10 p-3 text-xs text-warning">
            {validationIssues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        ) : null}

        {error ? <p className="text-sm text-danger">{error}</p> : null}

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" disabled={loading} onClick={() => handleSubmit(true)}>
            Validate
          </Button>
          <Button type="button" variant="organic" size="sm" disabled={loading} onClick={() => handleSubmit(false)}>
            {publishNow ? "Publish" : "Schedule"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
