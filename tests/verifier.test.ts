import test from "node:test";
import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MockAgentProvider } from "../packages/codex-adapter/src/index.ts";
import { snapshotWorkspace, verifyOrderService } from "../packages/evidence/src/verifier.ts";

test("independent verifier catches the seeded bug and accepts the scoped fix", async () => { const root = await mkdtemp(join(tmpdir(), "veriswarm-")); const workspace = join(root, "fixture"); await cp("fixtures/order-service", workspace, { recursive: true }); const baseline = await snapshotWorkspace(workspace); const provider = new MockAgentProvider(); await provider.run({ runId: "test", taskId: "task", goal: "fix", workspace, prompt: "fix", timeoutMs: 1000, maxAttempts: 1, approvalRequired: false }); const result = await verifyOrderService(workspace, baseline); assert.equal(result.passed, true); });
test("verifier rejects unauthorized modifications", async () => { const root = await mkdtemp(join(tmpdir(), "veriswarm-")); const workspace = join(root, "fixture"); await cp("fixtures/order-service", workspace, { recursive: true }); const baseline = await snapshotWorkspace(workspace); await writeFile(join(workspace, "unexpected.txt"), "side effect"); const result = await verifyOrderService(workspace, baseline); assert.equal(result.passed, false); assert.deepEqual(result.unauthorizedFiles, ["unexpected.txt"]); });
