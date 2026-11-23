import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readdir, readFile } from "node:fs/promises";
import { isAbsolute, join, relative, resolve } from "node:path";
import type { VerifierResult } from "../../contracts/src/index.ts";

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

export type VerificationSpec = {
  command: string;
  args: string[];
  allowedChangedFiles: string[];
  requiredFiles: string[];
  timeoutMs?: number;
};

function safeWorkspacePath(workspace: string, candidate: string): string | undefined {
  const root = resolve(workspace);
  const resolved = resolve(root, candidate);
  const relativePath = relative(root, resolved);
  if (isAbsolute(candidate) || relativePath.startsWith("..") || relativePath.includes("..\\") || relativePath.includes("../")) return undefined;
  return resolved;
}

export async function verifyWorkspace(workspace: string, baseline: Map<string, string>, spec: VerificationSpec): Promise<VerifierResult> {
  const started = Date.now();
  const pathEscapes = spec.requiredFiles.filter((file) => !safeWorkspacePath(workspace, file));
  let stdout = "", stderr = "", exitCode = 1, timedOut = false;
  if (!pathEscapes.length) {
    try {
      const result = await execFileAsync(spec.command, spec.args, { cwd: workspace, maxBuffer: 2 * 1024 * 1024, timeout: spec.timeoutMs ?? 120000 });
      stdout = String(result.stdout); stderr = String(result.stderr); exitCode = 0;
    } catch (error) {
      const e = error as { stdout?: string; stderr?: string; code?: number | string; killed?: boolean; signal?: string };
      stdout = e.stdout ?? ""; stderr = e.stderr ?? String(error); timedOut = e.killed === true || e.signal === "SIGTERM" || e.code === "ETIMEDOUT"; exitCode = timedOut ? 124 : Number(e.code ?? 1);
    }
  } else stderr = "Required verification path escapes the scoped workspace.";
  const after = await snapshotWorkspace(workspace);
  const changed = [...new Set([...baseline.keys(), ...after.keys()])].filter((path) => baseline.get(path) !== after.get(path));
  const deletedFiles = [...baseline.keys()].filter((path) => !after.has(path));
  const unauthorizedFiles = changed.filter((file) => !spec.allowedChangedFiles.includes(file));
  const missingFiles = spec.requiredFiles.filter((file) => !pathEscapes.includes(file) && !after.has(file));
  const passed = !pathEscapes.length && !timedOut && exitCode === 0 && unauthorizedFiles.length === 0 && missingFiles.length === 0;
  return { passed, command: `${spec.command} ${spec.args.join(" ")}`, stdout, stderr, exitCode, checkedFiles: spec.requiredFiles, unauthorizedFiles, deletedFiles, missingFiles, pathEscapes, timedOut, durationMs: Date.now() - started, stateHash: workspaceStateHash(after) };
}

export async function verifyOrderService(workspace: string, baseline: Map<string, string>): Promise<VerifierResult> {
  return verifyWorkspace(workspace, baseline, { command: process.execPath, args: ["--test", "test/idempotency.test.js"], allowedChangedFiles: ["src/orderService.js"], requiredFiles: ["test/idempotency.test.js", "src/orderService.js"], timeoutMs: 120000 });
}
