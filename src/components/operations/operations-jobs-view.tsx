"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { apiFetch } from "@/lib/api/client";

type WorkerJobRow = {
  id: string;
  jobType: string;
  status: string;
  domainRefType: string;
  domainRefId: string;
  attemptCount: number;
  maxAttempts: number;
  safeErrorMessage: string | null;
  errorCategory: string | null;
  dueAt: string | null;
  nextRetryAt: string | null;
  scheduledAt: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
};

type JobsHealth = {
  queued: number;
  failed: number;
  retrying: number;
  oldestPendingAt: string | null;
  oldestReadyDueAt: string | null;
  scheduler?: {
    lagMs: number | null;
    missedHeartbeat: boolean;
    lastInvokedAt: string | null;
    schedulerSlaMinutes: number;
  };
};

function formatWhen(value: string | null): string {
  return value ? new Date(value).toLocaleString() : "—";
}

export function OperationsJobsView() {
  const { preference } = useWorkspace();
  const organisationId = preference.currentOrganisationId;
  const [jobs, setJobs] = useState<WorkerJobRow[]>([]);
  const [health, setHealth] = useState<JobsHealth | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!organisationId) return;
    const data = await apiFetch<{ jobs: WorkerJobRow[]; health: JobsHealth }>(
      `/api/operations/jobs?organisationId=${organisationId}`,
      { organisationId },
    );
    setJobs(data.jobs);
    setHealth(data.health);
  }, [organisationId]);

  useEffect(() => {
    void load().catch((error) => {
      setMessage(error instanceof Error ? error.message : "Failed to load jobs.");
    });
  }, [load]);

  async function retryJob(jobId: string) {
    if (!organisationId) return;
    await apiFetch(`/api/operations/jobs?organisationId=${organisationId}`, {
      method: "POST",
      organisationId,
      body: JSON.stringify({ action: "retry", jobId }),
    });
    await load();
  }

  async function cancelJob(jobId: string) {
    if (!organisationId) return;
    await apiFetch(`/api/operations/jobs?organisationId=${organisationId}`, {
      method: "POST",
      organisationId,
      body: JSON.stringify({ action: "cancel", jobId }),
    });
    await load();
  }

  return (
    <>
      <PageHeader
        title="Background jobs"
        description="Monitor queued, running, failed, and dead-letter worker jobs."
        breadcrumbs={[{ label: "Operations", href: "/operations" }, { label: "Jobs" }]}
      />
      <nav className="mb-4 flex flex-wrap gap-2">
        <Link href="/operations" className="text-sm underline">
          Overview
        </Link>
        <Link href="/operations/jobs" className="text-sm font-medium underline">
          Jobs
        </Link>
      </nav>
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
      {health ? (
        <div className="mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Queued</CardTitle>
            </CardHeader>
            <CardContent>{health.queued}</CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Retrying</CardTitle>
            </CardHeader>
            <CardContent>{health.retrying}</CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Failed / dead-letter</CardTitle>
            </CardHeader>
            <CardContent>{health.failed}</CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Oldest ready due</CardTitle>
            </CardHeader>
            <CardContent className="text-xs">{formatWhen(health.oldestReadyDueAt)}</CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Scheduler lag</CardTitle>
            </CardHeader>
            <CardContent className="text-xs">
              {health.scheduler?.missedHeartbeat ? (
                <span className="text-red-700">Missed heartbeat</span>
              ) : health.scheduler?.lagMs != null ? (
                `${Math.round(health.scheduler.lagMs / 60_000)} min`
              ) : (
                "—"
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle>Recent jobs</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {jobs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No worker jobs recorded yet.</p>
          ) : null}
          {jobs.map((job) => (
            <div
              key={job.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3 text-sm"
            >
              <div className="min-w-0">
                <p className="font-medium">
                  {job.jobType} · {job.domainRefType}
                </p>
                <p className="text-muted-foreground">
                  {job.domainRefId} · {job.attemptCount}/{job.maxAttempts} attempts
                </p>
                <p className="text-muted-foreground">
                  Due {formatWhen(job.dueAt)} · Next retry {formatWhen(job.nextRetryAt)}
                </p>
                {job.safeErrorMessage ? (
                  <p className="text-muted-foreground">{job.safeErrorMessage}</p>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{job.status}</Badge>
                {["FAILED", "DEAD_LETTER", "RETRY_WAIT"].includes(job.status) ? (
                  <Button size="sm" variant="outline" onClick={() => void retryJob(job.id)}>
                    Retry
                  </Button>
                ) : null}
                {["SCHEDULED", "READY", "PENDING"].includes(job.status) ? (
                  <Button size="sm" variant="outline" onClick={() => void cancelJob(job.id)}>
                    Cancel
                  </Button>
                ) : null}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </>
  );
}
