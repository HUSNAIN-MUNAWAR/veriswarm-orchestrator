import { assertAcyclic } from "./state-machine.ts";
import type { Strategy, Task } from "../../contracts/src/index.ts";

export function chooseStrategy(goal: string, riskScore: number, hasVerification: boolean): Strategy {
  if (riskScore >= 0.8 && hasVerification) return "parallel-adjudicated";
  if (riskScore >= 0.55) return "reviewed-worker";
  if (goal.toLowerCase().includes("research")) return "planner-worker";
  return "single-worker";
}

export function buildTaskPlan(runId: string, goal: string, workspace: string, strategy: Strategy, approvalRequired = false): Array<Omit<Task, "createdAt" | "updatedAt">> {
  const now = new Date().toISOString();
  const task = (id: string, title: string, description: string, role: Task["role"], dependsOn: string[] = [], requiresApproval = false): Omit<Task, "createdAt" | "updatedAt"> => ({ id, runId, title, description, role, status: "pending", dependsOn, attempts: 0, maxAttempts: 2, workspace, requiresApproval, });
  const tasks = [task(`${runId}:research`, "Inspect scoped workspace", `Inspect the repository and requirements for: ${goal}`, "researcher")];
  const worker = task(`${runId}:worker`, "Implement bounded change", goal, "codex-worker", [tasks[0].id], approvalRequired);
  tasks.push(worker);
  if (strategy === "reviewed-worker" || strategy === "parallel-adjudicated" || strategy === "risk-adaptive") tasks.push(task(`${runId}:review`, "Review worker diff", "Review the changed files for correctness, scope, and unsafe behavior.", "reviewer", [worker.id]));
  const verificationDepends = tasks.slice(1).map((t) => t.id);
  tasks.push(task(`${runId}:verify`, "Run independent verification", "Execute tests and repository-state assertions independently of the worker response.", "tester", verificationDepends));
  assertAcyclic(tasks);
  return tasks.map((t) => ({ ...t, createdAt: now, updatedAt: now }));
}
