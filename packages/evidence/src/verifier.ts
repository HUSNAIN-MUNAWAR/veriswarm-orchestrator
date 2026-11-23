import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import type { VerifierResult, WorkspaceChange } from "../../contracts/src/index.ts";

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

export function diffWorkspace(baseline: Map<string, string>, after: Map<string, string>): WorkspaceChange[] {
  const changes: WorkspaceChange[] = [];
  const added = [...after.keys()].filter((path) => !baseline.has(path)).sort();
  const deleted = [...baseline.keys()].filter((path) => !after.has(path)).sort();
  const addedByHash = new Map<string, string[]>();
  for (const path of added) { const hash = after.get(path)!; addedByHash.set(hash, [...(addedByHash.get(hash) ?? []), path]); }
  const deletedByHash = new Map<string, string[]>();
  for (const path of deleted) { const hash = baseline.get(path)!; deletedByHash.set(hash, [...(deletedByHash.get(hash) ?? []), path]); }
  for (const hash of [...deletedByHash.keys()].sort()) {
    const fromPaths = deletedByHash.get(hash)!;
    const toPaths = addedByHash.get(hash) ?? [];
    while (fromPaths.length > 0 && toPaths.length > 0) changes.push({ kind: "renamed", from: fromPaths.shift()!, to: toPaths.shift()!, sha256: hash });
  }
  for (const path of added) if (addedByHash.get(after.get(path)!)?.includes(path)) changes.push({ kind: "added", path, sha256: after.get(path) });
  for (const path of deleted) if (deletedByHash.get(baseline.get(path)!)?.includes(path)) changes.push({ kind: "deleted", path, sha256: baseline.get(path) });
  for (const path of [...baseline.keys()].filter((item) => after.has(item)).sort()) if (baseline.get(path) !== after.get(path)) changes.push({ kind: "changed", path, sha256: after.get(path) });
  return changes.sort((left, right) => changeKey(left).localeCompare(changeKey(right)));
}

export type VerifierOptions = { allowedPaths?: readonly (string | RegExp)[]; timeoutMs?: number };

export async function verifyOrderService(workspace: string, baseline: Map<string, string>, options: VerifierOptions = {}): Promise<VerifierResult> {
  const allowedPaths = options.allowedPaths ?? ["src/orderService.js"];
  const timeoutMs = options.timeoutMs ?? 30_000;
  let stdout = "", stderr = "", exitCode = 1, timedOut = false;
  const command = `${process.execPath} --test test/idempotency.test.js`;
  try {
    const result = await execFileAsync(process.execPath, ["--test", "test/idempotency.test.js"], { cwd: workspace, maxBuffer: 2 * 1024 * 1024, timeout: timeoutMs, killSignal: "SIGTERM" });
    stdout = String(result.stdout); stderr = String(result.stderr); exitCode = 0;
  } catch (error) {
    const e = error as { stdout?: string; stderr?: string; code?: number | string; killed?: boolean; signal?: string };
    stdout = e.stdout ?? ""; stderr = e.stderr ?? String(error);
    timedOut = e.code === "ETIMEDOUT" || (e.killed === true && e.signal === "SIGTERM");
    exitCode = typeof e.code === "number" ? e.code : timedOut ? 124 : 1;
  }
  const after = await snapshotWorkspace(workspace);
  const changes = diffWorkspace(baseline, after);
  const unauthorizedFiles = changes.flatMap((change) => {
    if (change.kind === "renamed") return pathsAllowed([change.from, change.to], allowedPaths) ? [] : [`${change.from} -> ${change.to}`];
    return pathsAllowed([change.path], allowedPaths) ? [] : [change.path];
  }).sort();
  const allowedPathRules = allowedPaths.map((rule) => rule instanceof RegExp ? `/${rule.source}/${rule.flags}` : rule);
  return { passed: exitCode === 0 && !timedOut && unauthorizedFiles.length === 0, command, stdout, stderr, exitCode, timedOut, checkedFiles: ["test/idempotency.test.js", ...allowedPathRules.filter((rule) => !rule.startsWith("/"))], unauthorizedFiles, changes, allowedPathRules, stateHash: createHash("sha256").update(JSON.stringify([...after.entries()].sort())).digest("hex") };
}

function pathsAllowed(paths: string[], rules: readonly (string | RegExp)[]): boolean {
  return paths.every((path) => rules.some((rule) => {
    if (typeof rule === "string") return rule === path;
    rule.lastIndex = 0;
    return rule.test(path);
  }));
}

function changeKey(change: WorkspaceChange): string {
  return change.kind === "renamed" ? `${change.kind}:${change.from}:${change.to}` : `${change.kind}:${change.path}`;
}
