"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button, ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { apiFetch } from "@/lib/api/client";
import { TASK_PRIORITY_LABELS, TASK_STATUS_LABELS } from "@/lib/tasks/constants";

type TaskDetail = {
  id: string;
  title: string;
  description: string | null;
  type: string;
  status: string;
  priority: string;
  version: number;
  dueAt: string | null;
  isOverdue: boolean;
  isBlocked: boolean;
  assignee: { id: string; displayName: string | null; email: string } | null;
  reporter: { id: string; displayName: string | null; email: string };
  campaign: { id: string; name: string } | null;
  sourceEntityType: string | null;
  sourceEntityId: string | null;
  dependencies: Array<{
    id: string;
    dependsOnTaskId: string;
    dependsOnTask: { id: string; title: string; status: string };
  }>;
  checklistItems: Array<{
    id: string;
    label: string;
    isCompleted: boolean;
    sortOrder: number;
  }>;
  comments: Array<{
    id: string;
    body: string;
    createdAt: string;
    authorUserId: string;
  }>;
  attachments: Array<{
    id: string;
    fileName: string;
    fileUrl: string;
    createdAt: string;
  }>;
  activities: Array<{
    id: string;
    activityType: string;
    summary: string;
    createdAt: string;
  }>;
};

export function MarketingTaskDetailView() {
  const params = useParams<{ taskId: string }>();
  const { preference } = useWorkspace();
  const [task, setTask] = useState<TaskDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [comment, setComment] = useState("");

  const organisationId = preference.currentOrganisationId;
  const brandId = preference.currentBrandId;
  const taskId = params.taskId;

  const loadTask = useCallback(async () => {
    if (!organisationId || !brandId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<{ item: TaskDetail }>(
        `/api/brands/${brandId}/marketing-tasks/${taskId}?organisationId=${organisationId}`,
        { organisationId },
      );
      setTask(data.item);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load task.");
    } finally {
      setLoading(false);
    }
  }, [organisationId, brandId, taskId]);

  useEffect(() => {
    void loadTask();
  }, [loadTask]);

  async function completeTask() {
    if (!organisationId || !brandId) return;
    await apiFetch(
      `/api/brands/${brandId}/marketing-tasks/${taskId}/complete?organisationId=${organisationId}`,
      { method: "POST", organisationId },
    );
    await loadTask();
  }

  async function addComment() {
    if (!organisationId || !brandId || !comment.trim()) return;
    await apiFetch(
      `/api/brands/${brandId}/marketing-tasks/${taskId}/comments?organisationId=${organisationId}`,
      { method: "POST", organisationId, body: JSON.stringify({ body: comment.trim() }) },
    );
    setComment("");
    await loadTask();
  }

  async function toggleChecklist(itemId: string, isCompleted: boolean) {
    if (!organisationId || !brandId) return;
    await apiFetch(
      `/api/brands/${brandId}/marketing-tasks/${taskId}/checklist/${itemId}?organisationId=${organisationId}`,
      { method: "PATCH", organisationId, body: JSON.stringify({ isCompleted }) },
    );
    await loadTask();
  }

  if (loading) return <p className="py-8 text-center text-muted-foreground">Loading…</p>;

  if (error || !task) {
    return (
      <div className="py-8 text-center">
        <p className="text-destructive">{error ?? "Task not found."}</p>
        <ButtonLink className="mt-4" variant="outline" size="sm" href="/tasks">
          Back to tasks
        </ButtonLink>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={task.title}
        description={`${task.type} · v${task.version}`}
        actions={
          <div className="flex items-center gap-2">
            <Badge>
              {TASK_STATUS_LABELS[task.status as keyof typeof TASK_STATUS_LABELS] ?? task.status}
            </Badge>
            <ButtonLink variant="outline" size="sm" href="/tasks">
              Back
            </ButtonLink>
            {task.status !== "DONE" && (
              <Button size="sm" onClick={() => void completeTask()}>
                Complete
              </Button>
            )}
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {task.description && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Description</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">{task.description}</p>
              </CardContent>
            </Card>
          )}

          {task.checklistItems.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Checklist</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {task.checklistItems.map((item) => (
                  <label key={item.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={item.isCompleted}
                      onChange={(e) => void toggleChecklist(item.id, e.target.checked)}
                    />
                    <span className={item.isCompleted ? "line-through text-muted-foreground" : ""}>
                      {item.label}
                    </span>
                  </label>
                ))}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Comments</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {task.comments.map((c) => (
                <div key={c.id} className="rounded-md border p-3 text-sm">
                  <p>{c.body}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Date(c.createdAt).toLocaleString()}
                  </p>
                </div>
              ))}
              <div className="flex gap-2">
                <Input
                  label="Comment"
                  placeholder="Add a comment…"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && void addComment()}
                />
                <Button size="sm" onClick={() => void addComment()} disabled={!comment.trim()}>
                  Post
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Priority</span>
                <span>
                  {TASK_PRIORITY_LABELS[task.priority as keyof typeof TASK_PRIORITY_LABELS]}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Assignee</span>
                <span>{task.assignee?.displayName ?? "Unassigned"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Reporter</span>
                <span>{task.reporter.displayName ?? task.reporter.email}</span>
              </div>
              {task.dueAt && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Due</span>
                  <span className={task.isOverdue ? "text-destructive" : ""}>
                    {new Date(task.dueAt).toLocaleString()}
                  </span>
                </div>
              )}
              {task.campaign && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Campaign</span>
                  <span>{task.campaign.name}</span>
                </div>
              )}
              {task.sourceEntityType && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Linked entity</span>
                  <span>
                    {task.sourceEntityType}/{task.sourceEntityId}
                  </span>
                </div>
              )}
              {task.isBlocked && <Badge variant="warning">Blocked by dependencies</Badge>}
            </CardContent>
          </Card>

          {task.dependencies.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Dependencies</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {task.dependencies.map((dep) => (
                  <div key={dep.id} className="text-sm">
                    <Link href={`/tasks/${dep.dependsOnTaskId}`} className="hover:underline">
                      {dep.dependsOnTask.title}
                    </Link>
                    <Badge variant="muted" className="ml-2 text-xs">
                      {dep.dependsOnTask.status}
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {task.attachments.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Attachments</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {task.attachments.map((a) => (
                  <a
                    key={a.id}
                    href={a.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-sm text-primary hover:underline"
                  >
                    {a.fileName}
                  </a>
                ))}
              </CardContent>
            </Card>
          )}

          {task.activities.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Activity</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {task.activities.map((a) => (
                  <div key={a.id} className="text-xs">
                    <p>{a.summary}</p>
                    <p className="text-muted-foreground">
                      {new Date(a.createdAt).toLocaleString()}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
