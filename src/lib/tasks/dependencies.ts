import type { MarketingTaskStatus } from "@prisma/client";

export type TaskNode = {
  id: string;
  status: MarketingTaskStatus;
};

export type DependencyEdge = {
  taskId: string;
  dependsOnTaskId: string;
};

/** Detect whether adding an edge would create a cycle. */
export function wouldCreateDependencyCycle(
  taskId: string,
  dependsOnTaskId: string,
  edges: DependencyEdge[],
): boolean {
  if (taskId === dependsOnTaskId) return true;

  const adjacency = new Map<string, string[]>();
  for (const edge of edges) {
    const list = adjacency.get(edge.dependsOnTaskId) ?? [];
    list.push(edge.taskId);
    adjacency.set(edge.dependsOnTaskId, list);
  }

  const proposed = adjacency.get(dependsOnTaskId) ?? [];
  proposed.push(taskId);
  adjacency.set(dependsOnTaskId, proposed);

  const visited = new Set<string>();
  const stack = [taskId];
  while (stack.length > 0) {
    const current = stack.pop()!;
    if (current === dependsOnTaskId) return true;
    if (visited.has(current)) continue;
    visited.add(current);
    for (const next of adjacency.get(current) ?? []) {
      stack.push(next);
    }
  }

  return false;
}

/** A task is blocked when any dependency is not DONE. */
export function computeBlockedStatus(
  task: TaskNode,
  dependencies: Array<{ dependsOnTask: TaskNode }>,
): MarketingTaskStatus {
  if (task.status === "DONE" || task.status === "CANCELLED") {
    return task.status;
  }

  const hasIncompleteBlocker = dependencies.some(
    (dep) => dep.dependsOnTask.status !== "DONE" && dep.dependsOnTask.status !== "CANCELLED",
  );

  if (hasIncompleteBlocker) return "BLOCKED";
  if (task.status === "BLOCKED") return "TODO";
  return task.status;
}

export function isTaskOverdue(
  dueAt: Date | null | undefined,
  status: MarketingTaskStatus,
  now = new Date(),
): boolean {
  if (!dueAt) return false;
  if (status === "DONE" || status === "CANCELLED") return false;
  return dueAt.getTime() < now.getTime();
}
