import type { RunStatus, TaskStatus } from "../../contracts/src/index.ts";

const transitions: Record<RunStatus, RunStatus[]> = {
  created: ["planned", "cancelled"],
  planned: ["validated", "failed", "cancelled"],
  validated: ["queued", "failed", "cancelled"],
  queued: ["running", "cancelled"],
  running: ["awaiting_approval", "verifying", "retry_pending", "failed", "cancelled"],
  awaiting_approval: ["running", "rejected", "cancelled"],
  verifying: ["completed", "retry_pending", "failed", "cancelled"],
  retry_pending: ["queued", "failed", "cancelled"],
  completed: [], failed: [], rejected: [], cancelled: []
};

export function canTransition(from: RunStatus, to: RunStatus): boolean {
  return transitions[from].includes(to);
}

export function assertTransition(from: RunStatus, to: RunStatus): void {
  if (!canTransition(from, to)) throw new Error(`Invalid run transition: ${from} -> ${to}`);
}

export function readyTasks(tasks: Array<{ status: TaskStatus; dependsOn: string[] }>): number[] {
  const completed = new Set(tasks.filter((t) => t.status === "completed").map((_, i) => i));
  return tasks.map((task, i) => task.status === "pending" && task.dependsOn.every((dependency) => completed.has(Number(dependency)) || dependency === "completed") ? i : -1).filter((i) => i >= 0);
}

export function taskDependenciesSatisfied(task: { dependsOn: string[] }, byId: Map<string, { status: TaskStatus }>): boolean {
  return task.dependsOn.every((dependency) => byId.get(dependency)?.status === "completed");
}

export function assertAcyclic(tasks: Array<{ id: string; dependsOn: string[] }>): void {
  const graph = new Map(tasks.map((task) => [task.id, task.dependsOn]));
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (id: string) => {
    if (visiting.has(id)) throw new Error(`Dependency cycle detected at ${id}`);
    if (visited.has(id)) return;
    visiting.add(id);
    for (const dependency of graph.get(id) ?? []) {
      if (!graph.has(dependency)) throw new Error(`Unknown dependency ${dependency} for ${id}`);
      visit(dependency);
    }
    visiting.delete(id);
    visited.add(id);
  };
  for (const id of graph.keys()) visit(id);
}
