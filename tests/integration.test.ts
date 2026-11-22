import test from "node:test";
import assert from "node:assert/strict";
import { cp, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FileStore } from "../packages/orchestration/src/store.ts";
import { executeRun } from "../packages/orchestration/src/scheduler.ts";
import { MockAgentProvider } from "../packages/codex-adapter/src/index.ts";

test("mock provider completes an end-to-end durable run", async () => { const root = await mkdtemp(join(tmpdir(), "veriswarm-")); const workspace = join(root, "fixture"); await cp("fixtures/order-service", workspace, { recursive: true }); const store = new FileStore(join(root, "store.json")); await store.load(); const run = await store.createRun({ projectId: "test", goal: "Fix idempotency", workspace, status: "created", strategy: "reviewed-worker", riskScore: 0.6 }); await executeRun(store, run.id, new MockAgentProvider()); const saved = store.snapshot(); assert.equal(saved.runs.find((item) => item.id === run.id)?.status, "completed"); assert.ok(saved.events.some((event) => event.type === "verification.completed")); });
