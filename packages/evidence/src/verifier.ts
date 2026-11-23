import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readdir, readFile } from "node:fs/promises";
import { isAbsolute, join, relative, resolve } from "node:path";
import type { VerifierResult, WorkspaceChange } from "../../contracts/src/index.ts";

const execFileAsync = promisify(execFile);

export async function snapshotWorkspace(workspace: string): Promise<Map<string, string>> {
  const root = resolve(workspace);
  const files = new Map<string, string>();
  async function walk(directory: string): Promise<void> {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const full = join(directory, entry.name);
      if (entry.name === "node_modules" || entry.name === ".git") continue;
      if (entry.isDirectory()) await walk(full);
      else files.set(relative(root, full).replaceAll("\\", "/"), createHash("sha256").update(await readFile(full)).digest("hex"));
    }
  }
  await walk(root); return files;
}

export function workspaceStateHash(snapshot: Map<string, string>): string {
  return createHash("sha256").update(JSON.stringify([...snapshot.entries()].sort())).digest("hex");
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
    const fromPaths = deletedByHash.get(hash)!; const toPaths = addedByHash.get(hash) ?? [];
    while (fromPaths.length > 0 && toPaths.length > 0) changes.push({ kind: "renamed", from: fromPaths.shift()!, to: toPaths.shift()!, sha256: hash });
  }
  for (const path of added) if (addedByHash.get(after.get(path)!)?.includes(path)) changes.push({ kind: "added", path, sha256: after.get(path) });
  for (const path of deleted) if (deletedByHash.get(baseline.get(path)!)?.includes(path)) changes.push({ kind: "deleted", path, sha256: baseline.get(path) });
  for (const path of [...baseline.keys()].filter((item) => after.has(item)).sort()) if (baseline.get(path) !== after.get(path)) changes.push({ kind: "changed", path, sha256: after.get(path) });
  return changes.sort((left, right) => changeKey(left).localeCompare(changeKey(right)));
}

export type VerifierOptions = { allowedPaths?: readonly (string | RegExp)[]; timeoutMs?: number };
export type VerificationSpec = { command: string; args: string[]; allowedChangedFiles: readonly (string | RegExp)[]; requiredFiles: string[]; timeoutMs?: number };

function safeWorkspacePath(workspace: string, candidate: string): string | undefined {
  const root = resolve(workspace); const resolved = resolve(root, candidate); const relativePath = relative(root, resolved);
  if (isAbsolute(candidate) || relativePath.startsWith("..") || relativePath.includes("..\\") || relativePath.includes("../")) return undefined;
  return resolved;
}

function pathsAllowed(paths: string[], rules: readonly (string | RegExp)[]): boolean {
  return paths.every((path) => rules.some((rule) => { if (typeof rule === "string") return rule === path; rule.lastIndex = 0; return rule.test(path); }));
}

function pathRules(rules: readonly (string | RegExp)[]): string[] {
  return rules.map((rule) => rule instanceof RegExp ? `/${rule.source}/${rule.flags}` : rule);
}

function changeKey(change: WorkspaceChange): string {
  return change.kind === "renamed" ? `${change.kind}:${change.from}:${change.to}` : `${change.kind}:${change.path}`;
}

export async function verifyWorkspace(workspace: string, baseline: Map<string, string>, spec: VerificationSpec): Promise<VerifierResult> {
  const started = Date.now(); const pathEscapes = spec.requiredFiles.filter((file) => !safeWorkspacePath(workspace, file));
  let stdout = "", stderr = "", exitCode = 1, timedOut = false;
  if (!pathEscapes.length) {
    try {
      const result = await execFileAsync(spec.command, spec.args, { cwd: workspace, maxBuffer: 2 * 1024 * 1024, timeout: spec.timeoutMs ?? 120000, killSignal: "SIGTERM" });
      stdout = String(result.stdout); stderr = String(result.stderr); exitCode = 0;
    } catch (error) {
      const e = error as { stdout?: string; stderr?: string; code?: number | string; killed?: boolean; signal?: string };
      stdout = e.stdout ?? ""; stderr = e.stderr ?? String(error); timedOut = e.code === "ETIMEDOUT" || (e.killed === true && e.signal === "SIGTERM"); exitCode = typeof e.code === "number" ? e.code : timedOut ? 124 : 1;
    }
  } else stderr = "Required verification path escapes the scoped workspace.";
  const after = await snapshotWorkspace(workspace); const changes = diffWorkspace(baseline, after);
  const unauthorizedFiles = changes.flatMap((change) => {
    if (change.kind === "renamed") return pathsAllowed([change.from, change.to], spec.allowedChangedFiles) ? [] : [`${change.from} -> ${change.to}`];
    return pathsAllowed([change.path], spec.allowedChangedFiles) ? [] : [change.path];
  }).sort();
  const deletedFiles = changes.flatMap((change) => change.kind === "deleted" ? [change.path] : []);
  const missingFiles = spec.requiredFiles.filter((file) => !pathEscapes.includes(file) && !after.has(file));
  const passed = !pathEscapes.length && !timedOut && exitCode === 0 && unauthorizedFiles.length === 0 && missingFiles.length === 0;
  return { passed, command: `${spec.command} ${spec.args.join(" ")}`, stdout, stderr, exitCode, checkedFiles: [...spec.requiredFiles, ...pathRules(spec.allowedChangedFiles).filter((rule) => !rule.startsWith("/"))], unauthorizedFiles, deletedFiles, missingFiles, pathEscapes, timedOut, durationMs: Date.now() - started, changes, allowedPathRules: pathRules(spec.allowedChangedFiles), stateHash: workspaceStateHash(after) };
}

export async function verifyOrderService(workspace: string, baseline: Map<string, string>, options: VerifierOptions = {}): Promise<VerifierResult> {
  return verifyWorkspace(workspace, baseline, { command: process.execPath, args: ["--test", "test/idempotency.test.js"], allowedChangedFiles: options.allowedPaths ?? ["src/orderService.js"], requiredFiles: ["test/idempotency.test.js", "src/orderService.js"], timeoutMs: options.timeoutMs ?? 120000 });
}

