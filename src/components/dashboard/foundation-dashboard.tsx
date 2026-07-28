import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import type {
  FoundationReadinessItem,
  FoundationReadinessStatus,
} from "@/lib/foundation/readiness";
import type { FoundationNextAction } from "@/lib/foundation/next-actions";
import type { FoundationDashboardData } from "@/server/services/foundation-dashboard-service";

function readinessBadgeVariant(
  status: FoundationReadinessStatus,
): "default" | "muted" | "warning" {
  if (status === "completed") return "default";
  if (status === "blocked" || status === "not_yet_available") return "warning";
  return "muted";
}

function readinessLabel(status: FoundationReadinessStatus): string {
  switch (status) {
    case "completed":
      return "Completed";
    case "incomplete":
      return "Incomplete";
    case "blocked":
      return "Blocked";
    case "not_yet_available":
      return "Not yet available";
  }
}

export function WorkspaceOverviewCard({ data }: { data: FoundationDashboardData }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Workspace overview</CardTitle>
        <CardDescription>Active organisation, project, and brand context.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Organisation</p>
          <p className="mt-1 text-sm font-medium text-slate-900">
            {data.workspace.organisation?.name ?? "Not selected"}
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Project</p>
          <p className="mt-1 text-sm font-medium text-slate-900">
            {data.workspace.project?.name ?? "Not selected"}
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Active brand</p>
          <p className="mt-1 text-sm font-medium text-slate-900">
            {data.workspace.brand?.name ?? "Not selected"}
          </p>
        </div>
        <div className="sm:col-span-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Onboarding
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <Badge variant={data.onboarding.completed ? "default" : "warning"}>
              {data.onboarding.completed ? "Completed" : "Incomplete"}
            </Badge>
            {!data.onboarding.completed ? (
              <Link href="/onboarding" className="text-sm text-slate-700 hover:underline">
                Resume onboarding
              </Link>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function ReadinessGrid({ items }: { items: FoundationReadinessItem[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Foundation readiness</CardTitle>
        <CardDescription>
          Deterministic setup status based on real configuration — no fabricated performance metrics.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" role="list">
          {items.map((item) => (
            <li
              key={item.category}
              className="rounded-lg border border-slate-200 p-4 focus-within:ring-2 focus-within:ring-slate-400"
              tabIndex={0}
            >
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-medium text-slate-900">{item.label}</p>
                <Badge variant={readinessBadgeVariant(item.status)}>{readinessLabel(item.status)}</Badge>
              </div>
              <p className="mt-2 text-sm text-slate-600">{item.summary}</p>
              {typeof item.score === "number" ? (
                <p className="mt-2 text-xs text-slate-500">Score: {item.score}%</p>
              ) : null}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

export function NextActionsCard({ actions }: { actions: FoundationNextAction[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recommended setup actions</CardTitle>
        <CardDescription>Rule-based next steps from your current configuration.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {actions.length === 0 ? (
          <p className="text-sm text-slate-600">
            Foundation setup looks complete for the active brand. Review connectors when platforms
            become available.
          </p>
        ) : (
          actions.map((action) => (
            <div
              key={action.id}
              className="rounded-lg border border-slate-200 p-4"
            >
              <p className="text-sm font-medium text-slate-900">{action.title}</p>
              <p className="mt-1 text-sm text-slate-600">{action.description}</p>
              <ButtonLink href={action.href} className="mt-3" variant="outline" size="sm">
                Open
              </ButtonLink>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

export function FoundationMetricsCard({ data }: { data: FoundationDashboardData }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Configuration summary</CardTitle>
        <CardDescription>Real counts from your workspace — not sample analytics.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <Metric label="Knowledge readiness" value={formatScore(data.metrics.knowledgeOverallScore)} />
        <Metric label="Connected channels" value={String(data.metrics.connectedChannelCount)} />
        <Metric label="Marketing objectives" value={String(data.metrics.marketingObjectiveCount)} />
        <Metric
          label="Approved assets"
          value={`${data.metrics.approvedMarketingAssetCount}/${data.metrics.marketingAssetCount}`}
        />
        <Metric
          label="AI providers configured"
          value={`${data.aiSummary.configuredProviders}/${data.aiSummary.totalProviders}`}
        />
      </CardContent>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function formatScore(score: number | null): string {
  return score === null ? "—" : `${score}%`;
}

export function ObjectivesCard({
  objectives,
  brandId,
}: {
  objectives: FoundationDashboardData["marketingObjectives"];
  brandId: string | null;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Marketing objectives</CardTitle>
        <CardDescription>Configured goals for the active brand.</CardDescription>
      </CardHeader>
      <CardContent>
        {objectives.length === 0 ? (
          <p className="text-sm text-slate-600">No objectives configured yet.</p>
        ) : (
          <ul className="space-y-2" role="list">
            {objectives.map((objective) => (
              <li
                key={objective.id}
                className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm"
              >
                <span className="font-medium text-slate-900">{objective.label}</span>
                <span className="text-slate-500">Priority {objective.priority}</span>
              </li>
            ))}
          </ul>
        )}
        {brandId ? (
          <Link
            href={`/brands/${brandId}/profile`}
            className="mt-4 inline-block text-sm text-slate-700 hover:underline"
          >
            Review brand profile
          </Link>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function RecentActivityCard({ data }: { data: FoundationDashboardData }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent activity</CardTitle>
        <CardDescription>Real audit events from your organisation.</CardDescription>
      </CardHeader>
      <CardContent>
        {!data.canViewAuditActivity ? (
          <p className="text-sm text-slate-600">
            Audit activity is available to roles with audit log access.
          </p>
        ) : data.recentActivity.length === 0 ? (
          <p className="text-sm text-slate-600">No recent workspace activity yet.</p>
        ) : (
          <ul className="space-y-3" role="list">
            {data.recentActivity.map((event) => (
              <li key={event.id} className="border-b border-slate-100 pb-3 last:border-0 last:pb-0">
                <p className="text-sm font-medium text-slate-900">{event.label}</p>
                <p className="text-xs text-slate-500">
                  {new Date(event.createdAt).toLocaleString()}
                </p>
              </li>
            ))}
          </ul>
        )}
        <Link href="/settings/audit-log" className="mt-4 inline-block text-sm text-slate-700 hover:underline">
          View full audit log
        </Link>
      </CardContent>
    </Card>
  );
}
