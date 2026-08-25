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
  createdAt: string;
};

export function OperationsJobsView() {
  const { preference } = useWorkspace();
  const organisationId = preference.currentOrganisationId;
  const [jobs, setJobs] = useState<WorkerJobRow[]>([]);
  const [health, setHealth] = useState<Record<string, unknown> | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!organisationId) return;
    const data = await apiFetch<{ jobs: WorkerJobRow[]; health: Record<string, unknown> }>(
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

  return (
    <>
      <PageHeader
        title="Background jobs"
        description="Monitor queued, running, and failed worker jobs."
        breadcrumbs={[{ label: "Operations", href: "/operations" }, { label: "Jobs" }]}
      />
      <nav className="mb-4 flex flex-wrap gap-2">
        <Link href="/operations" className="text-sm underline">Overview</Link>
        <Link href="/operations/jobs" className="text-sm underline font-medium">Jobs</Link>
      </nav>
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
      {health ? (
        <div className="mb-4 grid gap-3 md:grid-cols-4">
          <Card><CardHeader><CardTitle className="text-sm">Queued</CardTitle></CardHeader><CardContent>{String(health.queued ?? 0)}</CardContent></Card>
          <Card><CardHeader><CardTitle className="text-sm">Retrying</CardTitle></CardHeader><CardContent>{String(health.retrying ?? 0)}</CardContent></Card>
          <Card><CardHeader><CardTitle className="text-sm">Failed</CardTitle></CardHeader><CardContent>{String(health.failed ?? 0)}</CardContent></Card>
          <Card><CardHeader><CardTitle className="text-sm">Oldest pending</CardTitle></CardHeader><CardContent className="text-xs">{health.oldestPendingAt ? new Date(String(health.oldestPendingAt)).toLocaleString() : "—"}</CardContent></Card>
        </div>
      ) : null}
      <Card>
        <CardHeader><CardTitle>Recent jobs</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {jobs.map((job) => (
            <div key={job.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3 text-sm">
              <div>
                <p className="font-medium">{job.jobType}</p>
                <p className="text-muted-foreground">{job.domainRefType} · {job.attemptCount}/{job.maxAttempts} attempts</p>
                {job.safeErrorMessage ? <p className="text-muted-foreground">{job.safeErrorMessage}</p> : null}
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="muted">{job.status}</Badge>
                {["FAILED", "DEAD_LETTER", "RETRY_WAIT"].includes(job.status) ? (
                  <Button size="sm" variant="outline" onClick={() => retryJob(job.id)}>Retry</Button>
                ) : null}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </>
  );
}
