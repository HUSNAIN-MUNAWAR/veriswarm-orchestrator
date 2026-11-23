import { cp, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { FileStore } from "../packages/orchestration/src/store.ts";
import { executeRun } from "../packages/orchestration/src/scheduler.ts";
import { MockAgentProvider } from "../packages/codex-adapter/src/index.ts";
import { compareStrategies, qualify, type Outcome } from "../packages/evaluation/src/index.ts";
import { taskSuite, type TaskSuiteCase } from "../packages/evaluation/src/fixtures.ts";
import type { Strategy } from "../packages/contracts/src/index.ts";

const strategies: Strategy[] = ["single-worker", "planner-worker", "reviewed-worker", "parallel-adjudicated", "risk-adaptive"];
const riskScores: Record<Strategy, number> = { "single-worker": 0.2, "planner-worker": 0.3, "reviewed-worker": 0.6, "parallel-adjudicated": 0.85, "risk-adaptive": 0.7 };
const developmentCases = taskSuite.filter((item) => item.split === "development" && item.status === "evaluated");

type ExecutionRecord = { caseId: string; family: string; split: string; strategy: Strategy; provider: string; status: string; verified: boolean; reviewed: boolean; recovered: boolean; toolCalls: number; costUsd: number; totalEstimatedCostUsd: number; runId: string; verificationExitCode?: number; initialWorkspaceHash?: string; finalWorkspaceHash?: string };

async function executeCase(item: TaskSuiteCase, strategy: Strategy): Promise<ExecutionRecord> {
  const root = await mkdtemp(join(tmpdir(), "veriswarm-benchmark-"));
  try {
    const workspace = join(root, "workspace"); await cp(item.fixturePath ?? "fixtures/order-service", workspace, { recursive: true });
    const store = new FileStore(join(root, "store.json")); await store.load();
    const run = await store.createRun({ projectId: `benchmark-${item.id}`, goal: item.goal, workspace, status: "created", strategy, riskScore: riskScores[strategy], requiresApproval: false });
    await executeRun(store, run.id, new MockAgentProvider());
    const saved = store.snapshot(); const result = saved.runs.find((candidate) => candidate.id === run.id); const tasks = saved.tasks.filter((task) => task.runId === run.id); const verification = saved.events.find((event) => event.runId === run.id && event.type === "verification.completed");
    return { caseId: item.id, family: item.family, split: item.split, strategy, provider: result?.execution?.provider ?? "mock", status: result?.status ?? "failed", verified: result?.status === "completed", reviewed: tasks.some((task) => ["reviewer", "security-reviewer"].includes(task.role)), recovered: saved.events.some((event) => event.runId === run.id && event.type === "retry.scheduled"), toolCalls: result?.metrics?.toolCalls ?? 0, costUsd: result?.metrics?.estimatedCostUsd ?? 0, totalEstimatedCostUsd: result?.metrics?.totalEstimatedCostUsd ?? result?.metrics?.estimatedCostUsd ?? 0, runId: run.id, verificationExitCode: typeof verification?.payload.exitCode === "number" ? verification.payload.exitCode : undefined, initialWorkspaceHash: result?.execution?.initialWorkspaceHash, finalWorkspaceHash: result?.execution?.finalWorkspaceHash };
  } finally { await rm(root, { recursive: true, force: true }); }
}

const records: ExecutionRecord[] = [];
for (const strategy of strategies) for (const item of developmentCases) records.push(await executeCase(item, strategy));
const outcomes = Object.fromEntries(strategies.map((strategy) => [strategy, records.filter((record) => record.strategy === strategy).map((record): Outcome => ({ caseId: record.caseId, success: record.verified, reviewed: record.reviewed, costUsd: record.totalEstimatedCostUsd, toolCalls: record.toolCalls, recovered: record.recovered }))])) as Record<Strategy, Outcome[]>;
const comparison = compareStrategies(outcomes);
const qualification = qualify(outcomes["risk-adaptive"], 0.9, 0.95);
const report = { generatedAt: new Date().toISOString(), dataset: "repository-owned order idempotency fixtures executed through the durable scheduler", provider: "MockAgentProvider", executionMode: "actual isolated fixture executions; deterministic provider", taskSuite: { totalCases: taskSuite.length, developmentCases: developmentCases.length, heldOutCases: taskSuite.filter((item) => item.split === "held-out").length, evaluatedDevelopmentExecutions: records.length, heldOutStatus: "NOT EVALUATED" }, comparison, qualification: { ...qualification, status: "NOT EVALUATED", reason: "Development executions completed, but no held-out cases were run; this report cannot support deployment qualification." }, limitations: ["deterministic mock provider", "single evaluated task family", "held-out task families are declared but not evaluated", "cost is a tool-call proxy, not provider billing", "no CRM-Agent-Bench checkout"] };
await mkdir("reports", { recursive: true });
await writeFile("BENCHMARK_REPORT.json", JSON.stringify(report, null, 2));
await writeFile("reports/execution-results.json", JSON.stringify({ generatedAt: report.generatedAt, provider: report.provider, records }, null, 2));
await writeFile("reports/strategy-comparison.json", JSON.stringify({ generatedAt: report.generatedAt, comparison }, null, 2));
await writeFile("reports/reliability-evaluation.json", JSON.stringify({ generatedAt: report.generatedAt, qualification: report.qualification, developmentOnly: true }, null, 2));
await writeFile("reports/qualification-report.json", JSON.stringify({ generatedAt: report.generatedAt, status: "NOT EVALUATED", reason: report.qualification.reason, heldOutCases: report.taskSuite.heldOutCases, assumptions: report.limitations }, null, 2));
console.log(JSON.stringify(report, null, 2));
