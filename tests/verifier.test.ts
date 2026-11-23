import test from "node:test";
import assert from "node:assert/strict";
import { cp, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MockAgentProvider } from "../packages/codex-adapter/src/index.ts";
import { diffWorkspace, snapshotWorkspace, verifyOrderService } from "../packages/evidence/src/verifier.ts";

test("independent verifier catches the seeded bug and accepts the scoped fix", async () => { const root = await mkdtemp(join(tmpdir(), "veriswarm-")); const workspace = join(root, "fixture"); await cp("fixtures/order-service", workspace, { recursive: true }); const baseline = await snapshotWorkspace(workspace); const provider = new MockAgentProvider(); await provider.run({ runId: "test", taskId: "task", goal: "fix", workspace, prompt: "fix", timeoutMs: 1000, maxAttempts: 1, approvalRequired: false }); const result = await verifyOrderService(workspace, baseline); assert.equal(result.passed, true); });
test("verifier rejects unauthorized modifications", async () => { const root = await mkdtemp(join(tmpdir(), "veriswarm-")); const workspace = join(root, "fixture"); await cp("fixtures/order-service", workspace, { recursive: true }); const baseline = await snapshotWorkspace(workspace); await writeFile(join(workspace, "unexpected.txt"), "side effect"); const result = await verifyOrderService(workspace, baseline); assert.equal(result.passed, false); assert.deepEqual(result.unauthorizedFiles, ["unexpected.txt"]); });
test("diff classifies additions, changes, deletions, and content-preserving renames", () => {
  const changes = diffWorkspace(new Map([["changed.txt", "one"], ["deleted.txt", "gone"], ["old.txt", "same"]]), new Map([["changed.txt", "two"], ["added.txt", "new"], ["new.txt", "same"]]));
  assert.deepEqual(changes, [
    { kind: "added", path: "added.txt", sha256: "new" },
    { kind: "changed", path: "changed.txt", sha256: "two" },
    { kind: "deleted", path: "deleted.txt", sha256: "gone" },
    { kind: "renamed", from: "old.txt", to: "new.txt", sha256: "same" }
  ]);
});
test("verifier propagates a failing checked command and reports deleted files", async () => {
  const root = await mkdtemp(join(tmpdir(), "veriswarm-")); const workspace = join(root, "fixture"); await cp("fixtures/order-service", workspace, { recursive: true }); const baseline = await snapshotWorkspace(workspace);
  await rm(join(workspace, "test/idempotency.test.js"));
  const result = await verifyOrderService(workspace, baseline);
  assert.equal(result.passed, false); assert.notEqual(result.exitCode, 0); assert.ok(result.unauthorizedFiles.includes("test/idempotency.test.js"));
});
