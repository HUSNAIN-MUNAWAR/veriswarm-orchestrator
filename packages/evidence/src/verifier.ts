import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import type { VerifierResult } from "../../contracts/src/index.ts";

const execFileAsync = promisify(execFile);

export async function snapshotWorkspace(workspace: string): Promise<Map<string, string>> {
  const files = new Map<string, string>();
  async function walk(directory: string): Promise<void> {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const full = join(directory, entry.name);
      if (entry.name === "node_modules" || entry.name === ".git") continue;
      if (entry.isDirectory()) await walk(full);
      else files.set(relative(workspace, full).replaceAll("\\", "/"), createHash("sha256").update(await readFile(full)).digest("hex"));
    }
  }
  await walk(workspace); return files;
}

export async function verifyOrderService(workspace: string, baseline: Map<string, string>): Promise<VerifierResult> {
  let stdout = "", stderr = "", exitCode = 1;
  try { const result = await execFileAsync(process.execPath, ["--test", "test/idempotency.test.js"], { cwd: workspace, maxBuffer: 2 * 1024 * 1024 }); stdout = String(result.stdout); stderr = String(result.stderr); exitCode = 0; } catch (error) { const e = error as { stdout?: string; stderr?: string; code?: number }; stdout = e.stdout ?? ""; stderr = e.stderr ?? String(error); exitCode = Number(e.code ?? 1); }
  const after = await snapshotWorkspace(workspace);
  const changed = [...after.keys()].filter((path) => baseline.get(path) !== after.get(path));
  const allowed = new Set(["src/orderService.js"]);
  return { passed: exitCode === 0 && changed.every((file) => allowed.has(file)), command: `${process.execPath} --test test/idempotency.test.js`, stdout, stderr, exitCode, checkedFiles: ["test/idempotency.test.js", "src/orderService.js"], unauthorizedFiles: changed.filter((file) => !allowed.has(file)), stateHash: createHash("sha256").update(JSON.stringify([...after.entries()].sort())).digest("hex") };
}
