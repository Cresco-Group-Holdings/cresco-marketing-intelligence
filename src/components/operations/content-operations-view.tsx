"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button, ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { apiFetch } from "@/lib/api/client";
import {
  ASSIGNMENT_ROLE_LABELS,
  CAMPAIGN_STATUS_LABELS,
  TASK_STATUS_LABELS,
} from "@/lib/operations/constants";

export type OperationsMode =
  | "campaigns"
  | "campaign-detail"
  | "tasks"
  | "my-work"
  | "overdue"
  | "operations";

const taskNav = [
  ["All tasks", "/tasks"],
  ["My work", "/tasks/my-work"],
  ["Overdue", "/tasks/overdue"],
] as const;

type CampaignSummary = {
  id: string;
  name: string;
  objective: string | null;
  status: keyof typeof CAMPAIGN_STATUS_LABELS;
  startDate: string;
  endDate: string;
  targetPlatforms: string[];
  owner: { id: string; displayName: string | null; email: string };
  contentItemCount: number;
  taskCount: number;
  memberCount: number;
};

type TaskItem = {
  id: string;
  title: string;
  description: string | null;
  status: keyof typeof TASK_STATUS_LABELS;
  priority: string;
  dueAt: string | null;
  isOverdue: boolean;
  assignee: { id: string; displayName: string | null; email: string } | null;
  owner: { id: string; displayName: string | null; email: string };
  campaign: { id: string; name: string } | null;
  contentItem: { id: string; title: string } | null;
};

type OperationsOverview = {
  summary: {
    activeCampaigns: number;
    openTasks: number;
    overdueDeadlines: number;
    overdueTasks: number;
  };
  assignments: Array<{
    id: string;
    role: keyof typeof ASSIGNMENT_ROLE_LABELS;
    user: { id: string; displayName: string | null; email: string };
    campaignId: string | null;
    contentItemId: string | null;
    taskId: string | null;
  }>;
  activities: Array<{
    id: string;
    activityType: string;
    summary: string;
    createdAt: string;
    actor: { id: string; displayName: string | null; email: string };
  }>;
};

type CampaignDetail = CampaignSummary & {
  description: string | null;
  landingPageUrl: string | null;
  members: Array<{
    id: string;
    user: { id: string; displayName: string | null; email: string };
    role: string | null;
    addedAt: string;
  }>;
  contentItems: Array<{ id: string; title: string; status: string; contentType: string }>;
  tasks: Array<{
    id: string;
    title: string;
    status: string;
    dueAt: string | null;
    assignee: { id: string; displayName: string | null; email: string } | null;
  }>;
  deadlines: Array<{ id: string; deadlineType: string; dueAt: string; status: string; isOverdue: boolean }>;
  experiments: Array<{ id: string; title: string; status: string }>;
  activities: Array<{
    id: string;
    activityType: string;
    summary: string;
    createdAt: string;
    actor: { id: string; displayName: string | null; email: string };
  }>;
};

type ViewMode = "list" | "board" | "calendar" | "timeline";

export function ContentOperationsView({
  mode,
  campaignId,
}: {
  mode: OperationsMode;
  campaignId?: string;
}) {
  const { preference } = useWorkspace();
  const brandId = preference.currentBrandId;
  const organisationId = preference.currentOrganisationId;

  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [campaigns, setCampaigns] = useState<CampaignSummary[]>([]);
  const [campaignDetail, setCampaignDetail] = useState<CampaignDetail | null>(null);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [overview, setOverview] = useState<OperationsOverview | null>(null);
  const [loading, setLoading] = useState(false);
  const [newCampaignName, setNewCampaignName] = useState("");
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const taskQuery = useMemo(() => {
    const params = new URLSearchParams({ organisationId: organisationId ?? "" });
    if (mode === "my-work") params.set("myWork", "true");
    if (mode === "overdue") params.set("overdueOnly", "true");
    if (campaignId) params.set("campaignId", campaignId);
    return params.toString();
  }, [organisationId, mode, campaignId]);

  const loadCampaigns = useCallback(async () => {
    if (!brandId || !organisationId) return;
    setLoading(true);
    try {
      setCampaigns(
        await apiFetch<CampaignSummary[]>(
          `/api/brands/${brandId}/campaigns?organisationId=${organisationId}`,
          { organisationId },
        ),
      );
    } finally {
      setLoading(false);
    }
  }, [brandId, organisationId]);

  const loadCampaignDetail = useCallback(async () => {
    if (!brandId || !organisationId || !campaignId) return;
    setLoading(true);
    try {
      setCampaignDetail(
        await apiFetch<CampaignDetail>(
          `/api/brands/${brandId}/campaigns/${campaignId}?organisationId=${organisationId}`,
          { organisationId },
        ),
      );
    } finally {
      setLoading(false);
    }
  }, [brandId, organisationId, campaignId]);

  const loadTasks = useCallback(async () => {
    if (!brandId || !organisationId || mode === "campaigns" || mode === "operations") return;
    setLoading(true);
    try {
      setTasks(
        await apiFetch<TaskItem[]>(`/api/brands/${brandId}/tasks?${taskQuery}`, {
          organisationId,
        }),
      );
    } finally {
      setLoading(false);
    }
  }, [brandId, organisationId, mode, taskQuery]);

  const loadOverview = useCallback(async () => {
    if (!brandId || !organisationId) return;
    setLoading(true);
    try {
      setOverview(
        await apiFetch<OperationsOverview>(
          `/api/brands/${brandId}/operations?organisationId=${organisationId}`,
          { organisationId },
        ),
      );
    } finally {
      setLoading(false);
    }
  }, [brandId, organisationId]);

  useEffect(() => {
    if (mode === "campaigns") void loadCampaigns();
    if (mode === "campaign-detail") void loadCampaignDetail();
    if (mode === "tasks" || mode === "my-work" || mode === "overdue") void loadTasks();
    if (mode === "operations") void loadOverview();
  }, [mode, loadCampaigns, loadCampaignDetail, loadTasks, loadOverview]);

  async function createCampaign() {
    if (!brandId || !organisationId || !newCampaignName.trim()) return;
    const start = new Date();
    const end = new Date();
    end.setDate(end.getDate() + 30);
    try {
      await apiFetch(`/api/brands/${brandId}/campaigns?organisationId=${organisationId}`, {
        method: "POST",
        organisationId,
        body: JSON.stringify({
          name: newCampaignName.trim(),
          startDate: start.toISOString(),
          endDate: end.toISOString(),
        }),
      });
      setNewCampaignName("");
      setMessage("Campaign created.");
      await loadCampaigns();
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Failed to create campaign.");
    }
  }

  async function createTask() {
    if (!brandId || !organisationId || !newTaskTitle.trim()) return;
    try {
      await apiFetch(`/api/brands/${brandId}/tasks?organisationId=${organisationId}`, {
        method: "POST",
        organisationId,
        body: JSON.stringify({
          title: newTaskTitle.trim(),
          campaignId: campaignId ?? undefined,
        }),
      });
      setNewTaskTitle("");
      setMessage("Task created.");
      if (mode === "campaign-detail") await loadCampaignDetail();
      else await loadTasks();
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Failed to create task.");
    }
  }

  async function updateTaskStatus(taskId: string, status: string) {
    if (!brandId || !organisationId) return;
    try {
      await apiFetch(`/api/brands/${brandId}/tasks/${taskId}?organisationId=${organisationId}`, {
        method: "PATCH",
        organisationId,
        body: JSON.stringify({ status }),
      });
      await loadTasks();
      if (mode === "campaign-detail") await loadCampaignDetail();
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Failed to update task.");
    }
  }

  const pageTitle =
    mode === "campaigns"
      ? "Campaigns"
      : mode === "campaign-detail"
        ? campaignDetail?.name ?? "Campaign"
        : mode === "operations"
          ? "Content operations"
          : mode === "my-work"
            ? "My work"
            : mode === "overdue"
              ? "Overdue tasks"
              : "Tasks";

  const viewToggle = (mode === "tasks" || mode === "my-work" || mode === "overdue") && (
    <div className="flex flex-wrap gap-2">
      {(["list", "board", "calendar"] as ViewMode[]).map((view) => (
        <Button
          key={view}
          size="sm"
          variant={viewMode === view ? "primary" : "outline"}
          onClick={() => setViewMode(view)}
        >
          {view.charAt(0).toUpperCase() + view.slice(1)}
        </Button>
      ))}
    </div>
  );

  function renderTaskBoard(items: TaskItem[]) {
    const columns = ["TODO", "IN_PROGRESS", "IN_REVIEW", "BLOCKED", "COMPLETED"] as const;
    return (
      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-5">
        {columns.map((status) => (
          <Card key={status}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{TASK_STATUS_LABELS[status]}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {items
                .filter((task) => task.status === status)
                .map((task) => (
                  <div key={task.id} className="rounded-md border p-2 text-sm">
                    <p className="font-medium">{task.title}</p>
                    {task.dueAt && (
                      <p className={`text-xs ${task.isOverdue ? "text-red-600" : "text-muted-foreground"}`}>
                        Due {new Date(task.dueAt).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                ))}
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  function renderTaskCalendar(items: TaskItem[]) {
  const grouped = items.reduce<Record<string, TaskItem[]>>((acc, task) => {
      const key = task.dueAt ? task.dueAt.slice(0, 10) : "unscheduled";
      acc[key] = acc[key] ?? [];
      acc[key].push(task);
      return acc;
    }, {});
    return (
      <div className="space-y-4">
        {Object.entries(grouped)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([date, dateTasks]) => (
            <Card key={date}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">
                  {date === "unscheduled" ? "Unscheduled" : new Date(date).toLocaleDateString()}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {dateTasks.map((task) => (
                  <div key={task.id} className="flex items-center justify-between rounded-md border p-2 text-sm">
                    <span>{task.title}</span>
                    <Badge variant="muted">{TASK_STATUS_LABELS[task.status]}</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
      </div>
    );
  }

  function renderTaskList(items: TaskItem[]) {
    return (
      <div className="space-y-2">
        {items.map((task) => (
          <Card key={task.id}>
            <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
              <div>
                <p className="font-medium">{task.title}</p>
                <p className="text-sm text-muted-foreground">
                  {task.campaign?.name ?? "No campaign"}
                  {task.dueAt ? ` · Due ${new Date(task.dueAt).toLocaleDateString()}` : ""}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {task.isOverdue && <Badge variant="warning">Overdue</Badge>}
                <Badge variant="muted">{TASK_STATUS_LABELS[task.status]}</Badge>
                {task.status === "TODO" && (
                  <Button size="sm" variant="outline" onClick={() => void updateTaskStatus(task.id, "IN_PROGRESS")}>
                    Start
                  </Button>
                )}
                {task.status === "IN_PROGRESS" && (
                  <Button size="sm" variant="outline" onClick={() => void updateTaskStatus(task.id, "IN_REVIEW")}>
                    Submit review
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={pageTitle}
        description="Coordinate content production, ownership, review, and deadlines."
        actions={
          <div className="flex flex-wrap gap-2">
            <ButtonLink size="sm" variant={mode === "campaigns" ? "primary" : "outline"} href="/campaigns">
              Campaigns
            </ButtonLink>
            <ButtonLink
              size="sm"
              variant={mode.startsWith("task") || mode === "my-work" || mode === "overdue" ? "primary" : "outline"}
              href="/tasks"
            >
              Tasks
            </ButtonLink>
            <ButtonLink size="sm" variant={mode === "operations" ? "primary" : "outline"} href="/content/operations">
              Operations
            </ButtonLink>
          </div>
        }
      />

      {message && <p className="text-sm text-muted-foreground">{message}</p>}
      {loading && <p className="text-sm text-muted-foreground">Loading…</p>}

      {mode === "campaigns" && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">New campaign</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Input
                label="Campaign name"
                placeholder="Campaign name"
                value={newCampaignName}
                onChange={(event) => setNewCampaignName(event.target.value)}
              />
              <Button onClick={() => void createCampaign()}>Create campaign</Button>
            </CardContent>
          </Card>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {campaigns.map((campaign) => (
              <Card key={campaign.id}>
                <CardHeader>
                  <CardTitle className="text-base">
                    <Link href={`/campaigns/${campaign.id}`} className="hover:underline">
                      {campaign.name}
                    </Link>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <Badge variant="muted">{CAMPAIGN_STATUS_LABELS[campaign.status]}</Badge>
                  <p className="text-muted-foreground">
                    {new Date(campaign.startDate).toLocaleDateString()} –{" "}
                    {new Date(campaign.endDate).toLocaleDateString()}
                  </p>
                  <p>
                    {campaign.contentItemCount} content · {campaign.taskCount} tasks ·{" "}
                    {campaign.memberCount} members
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {mode === "campaign-detail" && campaignDetail && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Badge variant="muted">{CAMPAIGN_STATUS_LABELS[campaignDetail.status]}</Badge>
            <Badge variant="muted">
              {new Date(campaignDetail.startDate).toLocaleDateString()} –{" "}
              {new Date(campaignDetail.endDate).toLocaleDateString()}
            </Badge>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Campaign timeline</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {campaignDetail.deadlines.map((deadline) => (
                  <div key={deadline.id} className="flex items-center justify-between text-sm">
                    <span>{deadline.deadlineType.replace(/_/g, " ").toLowerCase()}</span>
                    <span className={deadline.isOverdue ? "text-red-600" : ""}>
                      {new Date(deadline.dueAt).toLocaleDateString()}
                    </span>
                  </div>
                ))}
                {campaignDetail.deadlines.length === 0 && (
                  <p className="text-sm text-muted-foreground">No deadlines set yet.</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Team</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {campaignDetail.members.map((member) => (
                  <div key={member.id} className="text-sm">
                    {member.user.displayName ?? member.user.email}
                    {member.role ? ` · ${member.role}` : ""}
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Linked content</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {campaignDetail.contentItems.map((item) => (
                <div key={item.id} className="flex items-center justify-between text-sm">
                  <Link href={`/content/${item.id}`} className="hover:underline">
                    {item.title}
                  </Link>
                  <Badge variant="muted">{item.status}</Badge>
                </div>
              ))}
              {campaignDetail.contentItems.length === 0 && (
                <p className="text-sm text-muted-foreground">No content linked yet.</p>
              )}
            </CardContent>
          </Card>

          {campaignDetail.experiments.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Experiments</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {campaignDetail.experiments.map((experiment) => (
                  <div key={experiment.id} className="flex items-center justify-between text-sm">
                    <span>{experiment.title}</span>
                    <Badge variant="muted">{experiment.status}</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Tasks</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Input
                  label="New task title"
                  placeholder="New task title"
                  value={newTaskTitle}
                  onChange={(event) => setNewTaskTitle(event.target.value)}
                />
                <Button onClick={() => void createTask()}>Add task</Button>
              </div>
              {renderTaskList(
                campaignDetail.tasks.map((task) => ({
                  ...task,
                  description: null,
                  priority: "NORMAL",
                  isOverdue:
                    !!task.dueAt &&
                    new Date(task.dueAt).getTime() < Date.now() &&
                    !["COMPLETED", "CANCELLED"].includes(task.status),
                  owner: campaignDetail.owner,
                  campaign: { id: campaignDetail.id, name: campaignDetail.name },
                  contentItem: null,
                  status: task.status as TaskItem["status"],
                })),
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Activity</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {campaignDetail.activities.map((activity) => (
                <div key={activity.id} className="text-sm">
                  <p>{activity.summary}</p>
                  <p className="text-xs text-muted-foreground">
                    {activity.actor.displayName ?? activity.actor.email} ·{" "}
                    {new Date(activity.createdAt).toLocaleString()}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {(mode === "tasks" || mode === "my-work" || mode === "overdue") && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              {taskNav.map(([label, href]) => (
                <ButtonLink
                  key={href}
                  size="sm"
                  href={href}
                  variant={
                    (href === "/tasks/my-work" && mode === "my-work") ||
                    (href === "/tasks/overdue" && mode === "overdue") ||
                    (href === "/tasks" && mode === "tasks")
                      ? "primary"
                      : "outline"
                  }
                >
                  {label}
                </ButtonLink>
              ))}
            </div>
            {viewToggle}
          </div>

          {mode === "tasks" && (
            <Card>
              <CardContent className="flex flex-wrap gap-2 py-4">
                <Input
                  label="New task title"
                  placeholder="New task title"
                  value={newTaskTitle}
                  onChange={(event) => setNewTaskTitle(event.target.value)}
                />
                <Button onClick={() => void createTask()}>Create task</Button>
              </CardContent>
            </Card>
          )}

          {viewMode === "board" && renderTaskBoard(tasks)}
          {viewMode === "calendar" && renderTaskCalendar(tasks)}
          {viewMode === "list" && renderTaskList(tasks)}
        </div>
      )}

      {mode === "operations" && overview && (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-4">
            {[
              ["Active campaigns", overview.summary.activeCampaigns],
              ["Open tasks", overview.summary.openTasks],
              ["Overdue deadlines", overview.summary.overdueDeadlines],
              ["Overdue tasks", overview.summary.overdueTasks],
            ].map(([label, value]) => (
              <Card key={label}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">{label}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-semibold">{value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Assignments</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {overview.assignments.map((assignment) => (
                  <div key={assignment.id} className="text-sm">
                    <span className="font-medium">
                      {ASSIGNMENT_ROLE_LABELS[assignment.role]}
                    </span>
                    {": "}
                    {assignment.user.displayName ?? assignment.user.email}
                  </div>
                ))}
                {overview.assignments.length === 0 && (
                  <p className="text-sm text-muted-foreground">No active assignments.</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Recent activity</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {overview.activities.map((activity) => (
                  <div key={activity.id} className="text-sm">
                    <p>{activity.summary}</p>
                    <p className="text-xs text-muted-foreground">
                      {activity.actor.displayName ?? activity.actor.email} ·{" "}
                      {new Date(activity.createdAt).toLocaleString()}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
