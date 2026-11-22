import { createHash } from "node:crypto";
import type { AgentExecutionContext, Task } from "../../contracts/src/index.ts";
import type { AgentProvider } from "../../codex-adapter/src/index.ts";
import { FileStore } from "./store.ts";
import { assertTransition, taskDependenciesSatisfied } from "./state-machine.ts";
import { buildTaskPlan } from "./planner.ts";
import { snapshotWorkspace, verifyOrderService } from "../../evidence/src/verifier.ts";

export async function executeRun(store: FileStore, runId: string, provider: AgentProvider): Promise<void> {
  const snapshot = store.snapshot(); const run = snapshot.runs.find((item) => item.id === runId); if (!run) throw new Error("Run not found");
  let current = run;
  if (current.status === "created") { assertTransition(current.status, "planned"); current = await store.updateRun(runId, { status: "planned" }); }
  if (!store.snapshot().tasks.some((task) => task.runId === runId)) for (const task of buildTaskPlan(runId, run.goal, run.workspace, run.strategy, process.env.VERISWARM_REQUIRE_APPROVAL === "true")) await store.addTask(task);
  const plannedTasks = store.snapshot().tasks.filter((task) => task.runId === runId);
  const workspace = plannedTasks[0]?.workspace; if (!workspace) throw new Error("No scoped workspace");
  const baseline = await snapshotWorkspace(workspace);
  if (current.status === "planned") { assertTransition(current.status, "validated"); current = await store.updateRun(runId, { status: "validated" }); await store.addEvent({ runId, type: "workflow.validated", payload: { strategy: run.strategy } }); }
  if (current.status === "validated") { assertTransition(current.status, "queued"); current = await store.updateRun(runId, { status: "queued" }); }
  const start = Date.now(); let toolCalls = 0;
  while (true) {
    const tasks = store.snapshot().tasks.filter((task) => task.runId === runId);
    const pending = tasks.filter((task) => ["pending", "ready", "failed"].includes(task.status));
    const byId = new Map(tasks.map((task) => [task.id, task]));
    const ready = pending.filter((task) => task.status !== "failed" && task.dependsOn.every((dependency) => taskDependenciesSatisfied({ dependsOn: [dependency] }, byId)));
    if (ready.length === 0) break;
    for (const task of ready) {
      current = store.snapshot().runs.find((item) => item.id === runId)!; if (current.status === "queued") { assertTransition(current.status, "running"); await store.updateRun(runId, { status: "running" }); }
      await store.updateTask(task.id, { status: "running", attempts: task.attempts + 1 }); await store.addEvent({ runId, taskId: task.id, type: "task.started", payload: { role: task.role, attempt: task.attempts + 1 } });
      if (task.requiresApproval) { const approval = await store.addApproval({ runId, taskId: task.id, status: "pending", reason: "This task can modify the scoped workspace." }); await store.updateTask(task.id, { status: "awaiting_approval" }); await store.updateRun(runId, { status: "awaiting_approval" }); await store.addEvent({ runId, taskId: task.id, type: "approval.requested", payload: { approvalId: approval.id } }); return; }
      await runTask(store, provider, runId, task, run.goal); toolCalls += 1;
    }
  }
  const finalTasks = store.snapshot().tasks.filter((task) => task.runId === runId);
  if (finalTasks.some((task) => task.status === "failed")) { await store.updateRun(runId, { status: "failed", error: "One or more tasks failed" }); return; }
  assertTransition(store.snapshot().runs.find((item) => item.id === runId)!.status, "verifying"); await store.updateRun(runId, { status: "verifying" });
  const verifier = await verifyOrderService(workspace, baseline);
  await store.addArtifact({ runId, kind: "verification", path: `verification/${runId}.json`, sha256: createHash("sha256").update(JSON.stringify(verifier)).digest("hex"), bytes: JSON.stringify(verifier).length });
  await store.addEvent({ runId, taskId: finalTasks.at(-1)?.id, type: "verification.completed", payload: verifier as unknown as Record<string, unknown> });
  const resultStatus = verifier.passed ? "completed" : "failed"; assertTransition(store.snapshot().runs.find((item) => item.id === runId)!.status, resultStatus); await store.updateRun(runId, { status: resultStatus, completedAt: new Date().toISOString(), metrics: { toolCalls, durationMs: Date.now() - start, estimatedCostUsd: Number((toolCalls * 0.012).toFixed(4)) } });
}

async function runTask(store: FileStore, provider: AgentProvider, runId: string, task: Task, goal: string): Promise<void> {
  try {
    const context: AgentExecutionContext = { runId, taskId: task.id, goal, workspace: task.workspace, prompt: `You are the bounded ${task.role} for VeriSwarm. Work only inside ${task.workspace}. Goal: ${goal}. Inspect before editing, make the smallest safe change, and report evidence.`, timeoutMs: Number(process.env.CODEX_TIMEOUT_MS ?? 120000), maxAttempts: task.maxAttempts, approvalRequired: task.requiresApproval };
    const result = await provider.run(context); for (const event of result.events) await store.addEvent({ runId, taskId: task.id, type: event.type, payload: event.payload });
    await store.addArtifact({ runId, taskId: task.id, kind: "output", path: `runs/${runId}/${task.id}.json`, sha256: createHash("sha256").update(result.finalResponse).digest("hex"), bytes: result.finalResponse.length });
    await store.updateTask(task.id, { status: "completed", result: result as unknown as Record<string, unknown> }); await store.addEvent({ runId, taskId: task.id, type: "task.completed", payload: { provider: result.provider, sessionId: result.sessionId, toolCalls: result.toolCalls, changedFiles: result.changedFiles } });
  } catch (error) { const message = error instanceof Error ? error.message : String(error); const next = task.attempts < task.maxAttempts ? "failed" : "failed"; await store.updateTask(task.id, { status: next, error: message }); await store.addEvent({ runId, taskId: task.id, type: "task.failed", payload: { error: message, retryable: task.attempts < task.maxAttempts } }); }
}
