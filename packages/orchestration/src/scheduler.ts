import { createHash } from "node:crypto";
import type { AgentExecutionContext, AgentExecutionResult, Task } from "../../contracts/src/index.ts";
import type { AgentProvider } from "../../codex-adapter/src/index.ts";
import { FileStore } from "./store.ts";
import { assertTransition, taskDependenciesSatisfied } from "./state-machine.ts";
import { buildTaskPlan } from "./planner.ts";
import { snapshotWorkspace, verifyOrderService, workspaceStateHash } from "../../evidence/src/verifier.ts";

export async function executeRun(store: FileStore, runId: string, provider: AgentProvider): Promise<void> {
  const initial = store.snapshot().runs.find((item) => item.id === runId); if (!initial) throw new Error("Run not found");
  let current = initial;
  if (current.status === "cancelled" || ["completed", "failed", "rejected"].includes(current.status)) return;
  if (current.status === "created") { assertTransition(current.status, "planned"); current = await store.updateRun(runId, { status: "planned" }); }
  if (!store.snapshot().tasks.some((task) => task.runId === runId)) for (const task of buildTaskPlan(runId, current.goal, current.workspace, current.strategy, current.requiresApproval || process.env.VERISWARM_REQUIRE_APPROVAL === "true")) await store.addTask(task);
  const plannedTasks = store.snapshot().tasks.filter((task) => task.runId === runId);
  const workspace = plannedTasks[0]?.workspace; if (!workspace) throw new Error("No scoped workspace");
  let baseline = current.execution?.initialWorkspaceFiles ? new Map(Object.entries(current.execution.initialWorkspaceFiles)) : await snapshotWorkspace(workspace);
  if (!current.execution?.initialWorkspaceFiles) { current = await store.updateRun(runId, { execution: { provider: provider.constructor.name === "MockAgentProvider" ? "mock" : provider.constructor.name === "CodexSdkProvider" ? "codex-sdk" : "codex-cli", initialWorkspaceHash: workspaceStateHash(baseline), initialWorkspaceFiles: Object.fromEntries(baseline), costSource: "tool-call proxy until provider billing is available" } }); }
  if (current.status === "planned") { assertTransition(current.status, "validated"); current = await store.updateRun(runId, { status: "validated" }); await store.addEvent({ runId, type: "workflow.validated", payload: { strategy: current.strategy }, dedupeKey: "workflow.validated" }); }
  if (current.status === "validated") { assertTransition(current.status, "queued"); current = await store.updateRun(runId, { status: "queued" }); }
  const start = Date.now(); let toolCalls = 0; let lastResult: AgentExecutionResult | undefined;
  while (true) {
    current = store.snapshot().runs.find((item) => item.id === runId)!;
    if (current.status === "cancelled") return;
    const tasks = store.snapshot().tasks.filter((task) => task.runId === runId);
    const byId = new Map(tasks.map((task) => [task.id, task]));
    const ready = tasks.filter((task) => ["pending", "ready"].includes(task.status) && task.dependsOn.every((dependency) => taskDependenciesSatisfied({ dependsOn: [dependency] }, byId)));
    if (!ready.length) break;
    for (const task of ready) {
      current = store.snapshot().runs.find((item) => item.id === runId)!; if (current.status === "cancelled") return;
      if (current.status === "queued") { assertTransition(current.status, "running"); await store.updateRun(runId, { status: "running" }); }
      if (task.requiresApproval) {
        const attempt = task.attempts + 1; await store.updateTask(task.id, { status: "running", attempts: attempt }); await store.addEvent({ runId, taskId: task.id, type: "task.started", payload: { role: task.role, attempt }, dedupeKey: `${task.id}:started:${attempt}` });
        const existing = store.snapshot().approvals.find((approval) => approval.taskId === task.id && approval.status === "pending"); const approval = existing ?? await store.addApproval({ runId, taskId: task.id, status: "pending", reason: "This task can modify the scoped workspace." }); await store.updateTask(task.id, { status: "awaiting_approval" }); await store.updateRun(runId, { status: "awaiting_approval" }); await store.addEvent({ runId, taskId: task.id, type: "approval.requested", payload: { approvalId: approval.id }, dedupeKey: `${task.id}:approval.requested` }); return;
      }
      const result = await runTask(store, provider, runId, task, current.goal); if (result) { lastResult = result; toolCalls += result.toolCalls; }
    }
  }
  const finalTasks = store.snapshot().tasks.filter((task) => task.runId === runId);
  if (finalTasks.some((task) => task.status === "failed")) { await store.updateRun(runId, { status: "failed", error: "One or more tasks failed", completedAt: new Date().toISOString() }); return; }
  current = store.snapshot().runs.find((item) => item.id === runId)!; if (current.status === "cancelled") return;
  if (current.status === "running" || current.status === "queued") { assertTransition(current.status, "verifying"); await store.updateRun(runId, { status: "verifying" }); }
  const verifier = await verifyOrderService(workspace, baseline);
  await store.addArtifact({ runId, kind: "verification", path: `verification/${runId}.json`, sha256: createHash("sha256").update(JSON.stringify(verifier)).digest("hex"), bytes: JSON.stringify(verifier).length });
  await store.addEvent({ runId, taskId: finalTasks.at(-1)?.id, type: "verification.completed", payload: verifier as unknown as Record<string, unknown>, dedupeKey: "verification.completed" });
  const resultStatus = verifier.passed ? "completed" : "failed"; assertTransition(store.snapshot().runs.find((item) => item.id === runId)!.status, resultStatus);
  const workerResult = finalTasks.find((task) => task.role === "codex-worker")?.result as Partial<AgentExecutionResult> | undefined;
  const reviewCount = finalTasks.filter((task) => ["reviewer", "security-reviewer"].includes(task.role)).length;
  const estimatedCostUsd = Number((toolCalls * 0.012).toFixed(4)); const humanReviewCostUsd = Number((reviewCount * 0.02).toFixed(4));
  await store.updateRun(runId, { status: resultStatus, completedAt: new Date().toISOString(), metrics: { toolCalls, durationMs: Date.now() - start, estimatedCostUsd, tokens: workerResult?.tokens, costSource: workerResult?.costSource ?? "tool-call proxy until provider billing is available", humanReviewCostUsd, totalEstimatedCostUsd: Number((estimatedCostUsd + humanReviewCostUsd).toFixed(4)) }, execution: { ...(current.execution ?? { initialWorkspaceHash: workspaceStateHash(baseline) }), provider: (workerResult?.provider ?? (provider.constructor.name === "MockAgentProvider" ? "mock" : "codex-sdk")) as AgentExecutionResult["provider"], model: workerResult?.model, promptVersionId: workerResult?.promptVersionId, finalWorkspaceHash: verifier.stateHash, verificationCommand: verifier.command, verificationExitCode: verifier.exitCode, decision: resultStatus === "completed" ? "verified-success" : "verification-failed", costSource: workerResult?.costSource ?? "tool-call proxy until provider billing is available" } });
  void lastResult;
}

async function runTask(store: FileStore, provider: AgentProvider, runId: string, task: Task, goal: string): Promise<AgentExecutionResult | undefined> {
  const current = store.snapshot().tasks.find((item) => item.id === task.id); if (!current) return undefined;
  const attempt = current.attempts + 1; await store.updateTask(task.id, { status: "running", attempts: attempt, error: undefined }); await store.addEvent({ runId, taskId: task.id, type: "task.started", payload: { role: task.role, attempt }, dedupeKey: `${task.id}:started:${attempt}` });
  const promptVersion = store.snapshot().promptVersions.find((prompt) => prompt.role === task.role && prompt.status === "frozen");
  const context: AgentExecutionContext = { runId, taskId: task.id, goal, workspace: task.workspace, role: task.role, promptVersionId: promptVersion?.id, prompt: `${promptVersion?.content ?? `You are the bounded ${task.role} for VeriSwarm.`}\n\nWork only inside ${task.workspace}. Goal: ${goal}. Inspect before editing, make the smallest safe change, and report evidence.`, timeoutMs: Number(process.env.CODEX_TIMEOUT_MS ?? 120000), maxAttempts: task.maxAttempts, approvalRequired: task.requiresApproval };
  try {
    const result = await provider.run(context); for (const [index, event] of result.events.entries()) await store.addEvent({ runId, taskId: task.id, type: event.type, payload: event.payload, dedupeKey: `${task.id}:provider:${attempt}:${index}` });
    await store.addArtifact({ runId, taskId: task.id, kind: "output", path: `runs/${runId}/${task.id}.json`, sha256: createHash("sha256").update(result.finalResponse).digest("hex"), bytes: result.finalResponse.length });
    await store.updateTask(task.id, { status: "completed", result: result as unknown as Record<string, unknown> }); await store.addEvent({ runId, taskId: task.id, type: "task.completed", payload: { provider: result.provider, model: result.model, sessionId: result.sessionId, toolCalls: result.toolCalls, changedFiles: result.changedFiles }, dedupeKey: `${task.id}:completed:${attempt}` }); return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error); await store.updateTask(task.id, { status: "failed", error: message }); await store.addEvent({ runId, taskId: task.id, type: "task.failed", payload: { error: message, retryable: attempt < current.maxAttempts }, dedupeKey: `${task.id}:failed:${attempt}` });
    if (attempt < current.maxAttempts) { await store.updateTask(task.id, { status: "pending" }); const activeRun = store.snapshot().runs.find((item) => item.id === runId); if (activeRun?.status === "running") { assertTransition(activeRun.status, "retry_pending"); await store.updateRun(runId, { status: "retry_pending" }); await store.addEvent({ runId, taskId: task.id, type: "retry.scheduled", payload: { attempt, nextAttempt: attempt + 1 }, dedupeKey: `${task.id}:retry:${attempt}` }); assertTransition("retry_pending", "queued"); await store.updateRun(runId, { status: "queued" }); } }
    return undefined;
  }
}
