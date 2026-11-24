import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FileStore } from "../packages/orchestration/src/store.ts";

const runInput = {
  projectId: "store-test",
  goal: "validate atomic persistence",
  workspace: ".",
  status: "created" as const,
  strategy: "single-worker" as const,
  riskScore: 0.1,
  requiresApproval: false,
};

test("FileStore atomically persists a reloadable snapshot", async () => {
  const root = await mkdtemp(join(tmpdir(), "veriswarm-store-"));
  const file = join(root, "state.json");
  const store = new FileStore(file);
  await store.load();
  const run = await store.createRun(runInput);
  const reloaded = new FileStore(file);
  await reloaded.load();
  assert.equal(reloaded.snapshot().runs[0]?.id, run.id);
  assert.doesNotMatch(await readFile(file, "utf8"), /\.tmp/);
});

test("FileStore rejects malformed persisted state instead of silently resetting it", async () => {
  const root = await mkdtemp(join(tmpdir(), "veriswarm-store-"));
  const file = join(root, "state.json");
  await writeFile(file, "{\"runs\":[]}");
  await assert.rejects(() => new FileStore(file).load(), /Unable to load persisted store/);
});
