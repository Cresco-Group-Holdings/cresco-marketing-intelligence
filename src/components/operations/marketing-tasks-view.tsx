"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { apiFetch } from "@/lib/api/client";
import { BOARD_COLUMNS, TASK_PRIORITY_LABELS, TASK_STATUS_LABELS } from "@/lib/tasks/constants";

export type MarketingTaskItem = {
  id: string;
  title: string;
  description: string | null;
  type: string;
  status: string;
  priority: string;
  dueAt: string | null;
  isOverdue: boolean;
  isBlocked: boolean;
  assignee: { id: string; displayName: string | null; email: string } | null;
  reporter: { id: string; displayName: string | null; email: string };
  campaign: { id: string; name: string } | null;
  sourceEntityType: string | null;
  sourceEntityId: string | null;
};

type ViewMode = "list" | "board" | "my-work" | "overdue" | "blocked";

type Props = {
  mode?: ViewMode;
};

function priorityVariant(priority: string): "default" | "muted" | "warning" {
  if (priority === "URGENT" || priority === "HIGH") return "warning";
  if (priority === "LOW") return "muted";
  return "default";
}

export function MarketingTasksView({ mode = "list" }: Props) {
  const { preference } = useWorkspace();
  const [tasks, setTasks] = useState<MarketingTaskItem[]>([]);
  const [view, setView] = useState<"list" | "board">(mode === "board" ? "board" : "list");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");

  const organisationId = preference.currentOrganisationId;
  const brandId = preference.currentBrandId;

  const loadTasks = useCallback(async () => {
    if (!organisationId || !brandId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams({ organisationId });
      if (mode === "my-work") query.set("myTasks", "true");
      if (mode === "overdue") query.set("overdueOnly", "true");
      if (mode === "blocked") query.set("blockedOnly", "true");

      const data = await apiFetch<{ items: MarketingTaskItem[] }>(
        `/api/brands/${brandId}/marketing-tasks?${query.toString()}`,
        { organisationId },
      );
      setTasks(data.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tasks.");
    } finally {
      setLoading(false);
    }
  }, [organisationId, brandId, mode]);

  useEffect(() => {
    void loadTasks();
  }, [loadTasks]);

  const boardGroups = useMemo(() => {
    const groups = new Map<string, MarketingTaskItem[]>();
    for (const col of BOARD_COLUMNS) groups.set(col, []);
    for (const task of tasks) {
      const col = BOARD_COLUMNS.includes(task.status as (typeof BOARD_COLUMNS)[number])
        ? task.status
        : "TODO";
      const list = groups.get(col) ?? [];
      list.push(task);
      groups.set(col, list);
    }
    return groups;
  }, [tasks]);

  async function createTask() {
    if (!organisationId || !brandId || !newTitle.trim()) return;
    await apiFetch(`/api/brands/${brandId}/marketing-tasks?organisationId=${organisationId}`, {
      method: "POST",
      organisationId,
      body: { title: newTitle.trim() },
    });
    setNewTitle("");
    await loadTasks();
  }

  const title =
    mode === "my-work"
      ? "My tasks"
      : mode === "overdue"
        ? "Overdue tasks"
        : mode === "blocked"
          ? "Blocked tasks"
          : "Tasks";

  return (
    <div className="space-y-6">
      <PageHeader
        title={title}
        description="Canonical task management across campaigns, content, assets, and experiments."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href="/approvals">Approval inbox</Link>
            </Button>
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <Link href="/tasks" className="text-sm text-muted-foreground hover:underline">
          All
        </Link>
        <Link href="/tasks/my-work" className="text-sm text-muted-foreground hover:underline">
          My work
        </Link>
        <Link href="/tasks/overdue" className="text-sm text-muted-foreground hover:underline">
          Overdue
        </Link>
        <Link href="/tasks/blocked" className="text-sm text-muted-foreground hover:underline">
          Blocked
        </Link>
        {mode === "list" && (
          <>
            <Button
              size="sm"
              variant={view === "list" ? "default" : "outline"}
              onClick={() => setView("list")}
            >
              List
            </Button>
            <Button
              size="sm"
              variant={view === "board" ? "default" : "outline"}
              onClick={() => setView("board")}
            >
              Board
            </Button>
          </>
        )}
      </div>

      <div className="flex gap-2">
        <Input
          placeholder="New task title…"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void createTask()}
        />
        <Button size="sm" onClick={() => void createTask()} disabled={!newTitle.trim()}>
          Add task
        </Button>
      </div>

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

      {!loading && !error && tasks.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">No tasks found.</CardContent>
        </Card>
      )}

      {!loading && !error && tasks.length > 0 && view === "list" && (
        <div className="space-y-2">
          {tasks.map((task) => (
            <Link
              key={task.id}
              href={`/tasks/${task.id}`}
              className="block rounded-md border p-4 transition-colors hover:bg-muted/50"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-medium">{task.title}</p>
                  {task.description && (
                    <p className="mt-1 text-sm text-muted-foreground line-clamp-1">
                      {task.description}
                    </p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-1">
                    <Badge variant="muted">
                      {TASK_STATUS_LABELS[task.status as keyof typeof TASK_STATUS_LABELS] ??
                        task.status}
                    </Badge>
                    <Badge variant={priorityVariant(task.priority)}>
                      {TASK_PRIORITY_LABELS[task.priority as keyof typeof TASK_PRIORITY_LABELS] ??
                        task.priority}
                    </Badge>
                    {task.isOverdue && <Badge variant="warning">Overdue</Badge>}
                    {task.isBlocked && <Badge variant="warning">Blocked</Badge>}
                  </div>
                </div>
                <div className="text-right text-sm text-muted-foreground">
                  {task.assignee?.displayName ?? task.assignee?.email ?? "Unassigned"}
                  {task.dueAt && (
                    <p className="mt-1">{new Date(task.dueAt).toLocaleDateString()}</p>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {!loading && !error && tasks.length > 0 && view === "board" && (
        <div className="grid gap-4 overflow-x-auto md:grid-cols-3 lg:grid-cols-6">
          {BOARD_COLUMNS.map((column) => (
            <Card key={column} className="min-w-[200px]">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  {TASK_STATUS_LABELS[column]}
                  <span className="ml-2 text-muted-foreground">
                    ({boardGroups.get(column)?.length ?? 0})
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {(boardGroups.get(column) ?? []).map((task) => (
                  <Link
                    key={task.id}
                    href={`/tasks/${task.id}`}
                    className="block rounded-md border p-3 transition-colors hover:bg-muted/50"
                  >
                    <p className="text-sm font-medium leading-tight">{task.title}</p>
                    {task.isOverdue && (
                      <Badge variant="warning" className="mt-2 text-xs">
                        Overdue
                      </Badge>
                    )}
                  </Link>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
