import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { AgentEvent, Artifact, ApprovalRequest, EvaluationRecord, PromptVersion, Run, StoreData, Task } from "../../contracts/src/index.ts";
import { EventSchema, RunSchema, TaskSchema } from "../../contracts/src/index.ts";

const empty: StoreData = { runs: [], tasks: [], events: [], artifacts: [], approvals: [], promptVersions: [], evaluations: [] };

export class FileStore {
  private data: StoreData = structuredClone(empty);
  private loaded = false;
  constructor(private readonly filePath = join(process.cwd(), "data", "veriswarm.json")) {}

  async load(): Promise<void> {
    if (this.loaded) return;
    await mkdir(dirname(this.filePath), { recursive: true });
    try { this.data = JSON.parse(await readFile(this.filePath, "utf8")) as StoreData; } catch { await this.persist(); }
    this.loaded = true;
  }
  snapshot(): StoreData { return structuredClone(this.data); }
  async persist(): Promise<void> { await mkdir(dirname(this.filePath), { recursive: true }); await writeFile(this.filePath, JSON.stringify(this.data, null, 2)); }
  async createRun(input: Omit<Run, "id" | "version" | "createdAt" | "updatedAt">): Promise<Run> {
    const now = new Date().toISOString(); const run = RunSchema.parse({ ...input, id: randomUUID(), version: 0, createdAt: now, updatedAt: now });
    this.data.runs.push(run); await this.persist(); return run;
  }
  async updateRun(id: string, patch: Partial<Run>, expectedVersion?: number): Promise<Run> {
    const index = this.data.runs.findIndex((r) => r.id === id); if (index < 0) throw new Error("Run not found");
    const current = this.data.runs[index]; if (expectedVersion !== undefined && current.version !== expectedVersion) throw new Error("Optimistic lock conflict");
    const next = RunSchema.parse({ ...current, ...patch, version: current.version + 1, updatedAt: new Date().toISOString() }); this.data.runs[index] = next; await this.persist(); return next;
  }
  async addTask(input: Omit<Task, "createdAt" | "updatedAt">): Promise<Task> { const now = new Date().toISOString(); const task = TaskSchema.parse({ ...input, createdAt: now, updatedAt: now }); this.data.tasks.push(task); await this.persist(); return task; }
  async updateTask(id: string, patch: Partial<Task>): Promise<Task> { const index = this.data.tasks.findIndex((t) => t.id === id); if (index < 0) throw new Error("Task not found"); const task = TaskSchema.parse({ ...this.data.tasks[index], ...patch, updatedAt: new Date().toISOString() }); this.data.tasks[index] = task; await this.persist(); return task; }
  async addEvent(input: Omit<AgentEvent, "id" | "timestamp" | "hash">): Promise<AgentEvent> {
    if (input.dedupeKey) { const existing = this.data.events.find((event) => event.runId === input.runId && event.dedupeKey === input.dedupeKey); if (existing) return existing; }
    const timestamp = new Date().toISOString(); const body = JSON.stringify({ ...input, timestamp }); const event: AgentEvent = { ...input, id: randomUUID(), timestamp, hash: createHash("sha256").update(body).digest("hex") }; this.data.events.push(event); await this.persist(); return event;
  }
  async addArtifact(input: Omit<Artifact, "id" | "createdAt">): Promise<Artifact> { const artifact = { ...input, id: randomUUID(), createdAt: new Date().toISOString() }; this.data.artifacts.push(artifact); await this.persist(); return artifact; }
  async addApproval(input: Omit<ApprovalRequest, "id">): Promise<ApprovalRequest> { const approval = { ...input, id: randomUUID() }; this.data.approvals.push(approval); await this.persist(); return approval; }
  async decideApproval(id: string, status: "approved" | "rejected", decidedBy: string): Promise<ApprovalRequest> { const approval = this.data.approvals.find((a) => a.id === id); if (!approval) throw new Error("Approval not found"); if (approval.status !== "pending") throw new Error("Approval has already been decided"); approval.status = status; approval.decidedBy = decidedBy; approval.decidedAt = new Date().toISOString(); await this.persist(); return approval; }
  async cancelRun(id: string, reason = "Cancelled by operator"): Promise<Run> { const run = this.data.runs.find((item) => item.id === id); if (!run) throw new Error("Run not found"); if (["completed", "failed", "rejected", "cancelled"].includes(run.status)) return run; const updated = await this.updateRun(id, { status: "cancelled", error: reason }); for (const task of this.data.tasks.filter((item) => item.runId === id && !["completed", "failed", "cancelled", "skipped"].includes(item.status))) await this.updateTask(task.id, { status: "cancelled", error: reason }); await this.addEvent({ runId: id, type: "run.cancelled", payload: { reason }, dedupeKey: "run.cancelled" }); return updated; }
  async addPromptVersion(input: Omit<PromptVersion, "id" | "createdAt">): Promise<PromptVersion> { const version = { ...input, id: randomUUID(), createdAt: new Date().toISOString() }; this.data.promptVersions.push(version); await this.persist(); return version; }
  async addEvaluation(input: Omit<EvaluationRecord, "id" | "createdAt">): Promise<EvaluationRecord> { const evaluation = { ...input, id: randomUUID(), createdAt: new Date().toISOString() }; this.data.evaluations.push(evaluation); await this.persist(); return evaluation; }
}
