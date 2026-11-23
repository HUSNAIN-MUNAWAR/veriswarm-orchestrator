import { cp, mkdir, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { FileStore } from "../packages/orchestration/src/store.ts";
import { executeRun } from "../packages/orchestration/src/scheduler.ts";
import { providerFromEnvironment } from "../packages/codex-adapter/src/index.ts";
import { chooseStrategy } from "../packages/orchestration/src/planner.ts";
import { verifyOrderService, snapshotWorkspace } from "../packages/evidence/src/verifier.ts";

const provider = providerFromEnvironment();
const docsDemo = resolve("docs/demo"); await mkdir(docsDemo, { recursive: true });
const root = resolve("data/demo"); await rm(root, { recursive: true, force: true }); await mkdir(root, { recursive: true }); const workspace = join(root, "order-service"); await cp(resolve("fixtures/order-service"), workspace, { recursive: true });
const store = new FileStore(join(root, "store.json")); await store.load();
const run = await store.createRun({ projectId: "demo", goal: "Fix the seeded idempotency regression and leave no unauthorized files changed.", workspace, status: "created", strategy: chooseStrategy("Fix idempotency", 0.6, true), riskScore: 0.6, requiresApproval: false });
await store.addEvent({ runId: run.id, type: "demo.started", payload: { provider: provider.constructor.name, workspace: "isolated copy", truth: "fixture run" } });
await executeRun(store, run.id, provider);
const final = store.snapshot(); const result = final.runs.find((item) => item.id === run.id); const verification = final.events.find((event) => event.type === "verification.completed"); const manifest = { commitSha: "working-tree-demo-no-commit", sdkRuntime: provider.constructor.name === "CodexSdkProvider" ? "@openai/codex-sdk 0.171.0" : provider.constructor.name === "CodexCliProvider" ? "codex CLI 0.171.0-alpha.13" : "MockAgentProvider (CI fixture)", provider: provider.constructor.name, runId: run.id, goal: run.goal, sessionIds: final.tasks.filter((task) => task.result).map((task) => (task.result as { sessionId?: string }).sessionId).filter(Boolean), status: result?.status, verificationHash: verification?.payload?.stateHash, events: final.events.length, capturedAt: new Date().toISOString(), video: "not captured in this environment" };
await import("node:fs/promises").then(async ({ writeFile }) => { await writeFile(join(root, "demo-manifest.json"), JSON.stringify(manifest, null, 2)); await writeFile(join(docsDemo, "demo-manifest.json"), JSON.stringify(manifest, null, 2)); await writeFile(join(docsDemo, "demo-run-events.jsonl"), final.events.map((event) => JSON.stringify(event)).join("\n") + "\n"); await writeFile(join(docsDemo, "demo-metrics.json"), JSON.stringify({ runId: run.id, provider: provider.constructor.name, status: result?.status, metrics: result?.metrics ?? null, verificationHash: verification?.payload?.stateHash, eventCount: final.events.length }, null, 2)); }); console.log(JSON.stringify({ runId: run.id, status: result?.status, events: final.events.length, workspace, manifest: join(root, "demo-manifest.json") }, null, 2));
