import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createHash } from "node:crypto";
import { Codex } from "@openai/codex-sdk";
import type { AgentExecutionContext, AgentExecutionResult } from "../../contracts/src/index.ts";

const execFileAsync = promisify(execFile);

export interface AgentProvider { run(context: AgentExecutionContext): Promise<AgentExecutionResult>; }

function eventPayload(item: unknown): Record<string, unknown> {
  if (!item || typeof item !== "object") return { value: item };
  const value = item as Record<string, unknown>;
  return { ...value };
}

export class CodexSdkProvider implements AgentProvider {
  constructor(private readonly options: { model?: string; timeoutMs?: number } = {}) {}
  async run(context: AgentExecutionContext): Promise<AgentExecutionResult> {
    const started = Date.now();
    const codexPath = process.env.CODEX_PATH ?? await discoverCodexPath();
    const codex = new Codex(codexPath ? { codexPathOverride: codexPath } : undefined);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), context.timeoutMs);
    const thread = codex.startThread({
      model: this.options.model || process.env.CODEX_MODEL || undefined,
      sandboxMode: "workspace-write",
      approvalPolicy: context.approvalRequired ? "on-request" : "never",
      workingDirectory: context.workspace,
      skipGitRepoCheck: true,
      networkAccessEnabled: false,
      webSearchMode: "disabled"
    });
    const events: Array<{ type: string; payload: Record<string, unknown> }> = [];
    try {
      const streamed = await withTimeout(thread.runStreamed(context.prompt, { signal: controller.signal }), context.timeoutMs, "Codex thread start timed out");
      const items: Array<Record<string, unknown>> = [];
      let usage = 0;
      for await (const event of streamed.events) {
        events.push({ type: event.type, payload: eventPayload(event) });
        if (event.type === "item.completed") items.push(event.item as unknown as Record<string, unknown>);
        if (event.type === "turn.completed") usage = event.usage.input_tokens + event.usage.output_tokens + event.usage.reasoning_output_tokens;
      }
      const finalResponse = items.filter((item) => item.type === "agent_message").map((item) => String(item.text ?? "")).join("\n");
      const toolCalls = items.filter((item) => item.type === "command_execution" || item.type === "mcp_tool_call").length;
      const changedFiles = items.flatMap((item) => item.type === "file_change" ? ((item.changes as Array<{ path: string }> | undefined) ?? []).map((change) => change.path) : []);
      return { provider: "codex-sdk", model: this.options.model || process.env.CODEX_MODEL || "codex-default", promptVersionId: context.promptVersionId, sessionId: thread.id ?? `sdk-${createHash("sha1").update(context.runId).digest("hex").slice(0, 12)}`, finalResponse, events, changedFiles, toolCalls, tokens: usage || undefined, durationMs: Date.now() - started, costSource: "provider usage unavailable; cost estimate is a tool-call proxy" };
    } finally { clearTimeout(timeout); }
  }
}

export class CodexCliProvider implements AgentProvider {
  async run(context: AgentExecutionContext): Promise<AgentExecutionResult> {
    const started = Date.now();
    const args = ["exec", "--json", "--sandbox", "workspace-write", "--skip-git-repo-check", ...(context.approvalRequired ? ["--approve-for-me"] : []), context.prompt];
    const result = await execFileAsync("codex", args, { cwd: context.workspace, maxBuffer: 8 * 1024 * 1024, timeout: context.timeoutMs, killSignal: "SIGTERM" });
    const events = String(result.stdout).split(/\r?\n/).filter(Boolean).map((line) => { try { const parsed = JSON.parse(line) as Record<string, unknown>; return { type: String(parsed.type ?? "unknown"), payload: parsed }; } catch { return { type: "raw", payload: { line } }; } });
    return { provider: "codex-cli", model: process.env.CODEX_MODEL || "codex-cli-default", promptVersionId: context.promptVersionId, sessionId: `cli-${Date.now()}`, finalResponse: events.at(-1)?.payload?.text ? String(events.at(-1)?.payload?.text) : String(result.stdout), events, changedFiles: [], toolCalls: events.filter((e) => e.type.includes("command")).length, durationMs: Date.now() - started, exitCode: 0, costSource: "provider usage unavailable; cost estimate is a tool-call proxy" };
  }
}

export class MockAgentProvider implements AgentProvider {
  constructor(private readonly behavior: "fix" | "fail" = "fix") {}
  async run(context: AgentExecutionContext): Promise<AgentExecutionResult> {
    const started = Date.now();
    const target = `${context.workspace}/src/orderService.js`;
    const { readFile, writeFile } = await import("node:fs/promises");
    const before = await readFile(target, "utf8");
    if (this.behavior === "fix" && context.role === "codex-worker") {
      const after = before.replace("if (seen.has(order.id)) { return; }", "if (seen.has(order.id)) { return orders.get(order.id); }");
      if (after !== before) await writeFile(target, after);
    }
    return { provider: "mock", model: "deterministic-fixture", promptVersionId: context.promptVersionId, sessionId: `mock-${context.runId}`, finalResponse: this.behavior === "fix" ? "Implemented the idempotency fix." : "I could not safely complete the requested change.", events: [{ type: "item.completed", payload: { item: { type: "file_change", path: "src/orderService.js" } } }], changedFiles: ["src/orderService.js"], toolCalls: 1, durationMs: Date.now() - started, costSource: "mock provider; no model billing" };
  }
}

export function providerFromEnvironment(): AgentProvider {
  if (process.env.VERISWARM_PROVIDER === "codex") return new CodexSdkProvider({ model: process.env.CODEX_MODEL });
  if (process.env.VERISWARM_PROVIDER === "cli") return new CodexCliProvider();
  return new MockAgentProvider();
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error(message)), timeoutMs); });
  try { return await Promise.race([promise, timeout]); } finally { if (timer) clearTimeout(timer); }
}

async function discoverCodexPath(): Promise<string | undefined> {
  if (process.platform !== "win32") return undefined;
  try { const result = await execFileAsync("where.exe", ["codex"]); return String(result.stdout).split(/\r?\n/).map((line) => line.trim()).find(Boolean); } catch { return undefined; }
}
