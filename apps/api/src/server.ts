import { createServer } from "node:http";
import { cp, mkdir, readFile } from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import { FileStore } from "../../../packages/orchestration/src/store.ts";
import { executeRun } from "../../../packages/orchestration/src/scheduler.ts";
import { chooseStrategy } from "../../../packages/orchestration/src/planner.ts";
import { providerFromEnvironment } from "../../../packages/codex-adapter/src/index.ts";
import { seedPromptVersions } from "../../../packages/prompt-lab/src/index.ts";

const port = Number(process.env.PORT ?? 4317);
const dataDir = resolve(process.env.VERISWARM_DATA_DIR ?? "./data");
const webRoot = resolve("apps/web");
const store = new FileStore(join(dataDir, "veriswarm.json"));
const provider = providerFromEnvironment();
await store.load();
await seedPromptVersions(store);

const json = (response: import("node:http").ServerResponse, status: number, body: unknown) => { response.writeHead(status, { "content-type": "application/json; charset=utf-8", "access-control-allow-origin": "*" }); response.end(JSON.stringify(body)); };
const body = async (request: import("node:http").IncomingMessage) => { let raw = ""; for await (const chunk of request) raw += chunk; return raw ? JSON.parse(raw) : {}; };
const route = (request: import("node:http").IncomingMessage) => new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);

const server = createServer(async (request, response) => {
  try {
    const url = route(request); const method = request.method ?? "GET";
    if (method === "OPTIONS") { response.writeHead(204, { "access-control-allow-origin": "*", "access-control-allow-methods": "GET,POST,OPTIONS", "access-control-allow-headers": "content-type" }); return response.end(); }
    if (method === "GET" && !url.pathname.startsWith("/api/")) {
      const relativePath = url.pathname === "/" ? "index.html" : url.pathname.slice(1);
      const filePath = resolve(webRoot, relativePath);
      if (filePath.startsWith(webRoot)) {
        try { const content = await readFile(filePath); const type = extname(filePath) === ".html" ? "text/html; charset=utf-8" : extname(filePath) === ".css" ? "text/css; charset=utf-8" : extname(filePath) === ".js" ? "text/javascript; charset=utf-8" : "application/octet-stream"; response.writeHead(200, { "content-type": type }); response.end(content); return; } catch { /* continue to JSON 404 */ }
      }
    }
    if (url.pathname === "/api/health") return json(response, 200, { ok: true, provider: provider.constructor.name, now: new Date().toISOString() });
    if (url.pathname === "/api/overview") { const data = store.snapshot(); return json(response, 200, { runs: data.runs.length, active: data.runs.filter((run) => ["running", "queued", "verifying", "awaiting_approval"].includes(run.status)).length, failures: data.runs.filter((run) => ["failed", "rejected", "cancelled"].includes(run.status)).length, costUsd: data.runs.reduce((sum, run) => sum + (run.metrics?.estimatedCostUsd ?? 0), 0), events: data.events.length }); }
    if (url.pathname === "/api/runs" && method === "GET") return json(response, 200, store.snapshot().runs.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
    if (url.pathname === "/api/runs" && method === "POST") {
      const input = await body(request); const riskScore = Math.max(0, Math.min(1, Number(input.riskScore ?? 0.35))); const run = await store.createRun({ projectId: "veriswarm-demo", goal: String(input.goal ?? "Fix the seeded idempotency regression and verify the repository."), workspace: "", status: "created", strategy: chooseStrategy(String(input.goal ?? ""), riskScore, true), riskScore });
      const workspace = join(dataDir, "workspaces", run.id); await mkdir(join(dataDir, "workspaces"), { recursive: true }); await cp(resolve("fixtures/order-service"), workspace, { recursive: true }); const saved = await store.updateRun(run.id, { workspace });
      await store.addEvent({ runId: run.id, type: "run.created", payload: { goal: saved.goal, strategy: saved.strategy, riskScore: saved.riskScore, workspace: "scoped" } }); return json(response, 201, saved);
    }
    const match = url.pathname.match(/^\/api\/runs\/([^/]+)(?:\/(events|start))?$/);
    if (match) {
      const id = match[1]; if (match[2] === "events") return json(response, 200, store.snapshot().events.filter((event) => event.runId === id));
      if (match[2] === "start" && method === "POST") { void executeRun(store, id, provider).catch(async (error) => { await store.updateRun(id, { status: "failed", error: error instanceof Error ? error.message : String(error) }); }); return json(response, 202, { accepted: true, runId: id }); }
      const data = store.snapshot(); return json(response, 200, { run: data.runs.find((run) => run.id === id), tasks: data.tasks.filter((task) => task.runId === id), events: data.events.filter((event) => event.runId === id), approvals: data.approvals.filter((approval) => approval.runId === id), artifacts: data.artifacts.filter((artifact) => artifact.runId === id) });
    }
    if (url.pathname === "/api/approvals" && method === "GET") return json(response, 200, store.snapshot().approvals.filter((approval) => approval.status === "pending"));
    const approvalMatch = url.pathname.match(/^\/api\/approvals\/([^/]+)$/); if (approvalMatch && method === "POST") { const input = await body(request); const approval = await store.decideApproval(approvalMatch[1], input.status === "approved" ? "approved" : "rejected", String(input.decidedBy ?? "operator")); if (approval.status === "approved") { await store.updateTask(approval.taskId, { status: "pending", requiresApproval: false }); await store.updateRun(approval.runId, { status: "queued" }); void executeRun(store, approval.runId, provider); } else { await store.updateTask(approval.taskId, { status: "cancelled" }); await store.updateRun(approval.runId, { status: "rejected" }); } return json(response, 200, approval); }
    if (url.pathname === "/api/prompts") return json(response, 200, store.snapshot().promptVersions);
    return json(response, 404, { error: "Not found" });
  } catch (error) { return json(response, 500, { error: error instanceof Error ? error.message : String(error) }); }
});

server.listen(port, () => console.log(`VeriSwarm API listening on http://localhost:${port}`));
