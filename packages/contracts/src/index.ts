export const RunStatusValues = ["created", "planned", "validated", "queued", "running", "awaiting_approval", "verifying", "retry_pending", "completed", "failed", "rejected", "cancelled"] as const;
export type RunStatus = (typeof RunStatusValues)[number];
export const TaskStatusValues = ["pending", "ready", "running", "awaiting_approval", "completed", "failed", "cancelled", "skipped"] as const;
export type TaskStatus = (typeof TaskStatusValues)[number];
export const AgentRoleValues = ["orchestrator", "planner", "researcher", "codex-worker", "tester", "reviewer", "security-reviewer", "evidence-collector", "prompt-optimizer", "qualification-analyst"] as const;
export type AgentRole = (typeof AgentRoleValues)[number];
export const StrategyValues = ["single-worker", "planner-worker", "reviewed-worker", "parallel-adjudicated", "risk-adaptive"] as const;
export type Strategy = (typeof StrategyValues)[number];

export type Task = { id: string; runId: string; title: string; description: string; role: AgentRole; status: TaskStatus; dependsOn: string[]; attempts: number; maxAttempts: number; workspace: string; requiresApproval: boolean; result?: Record<string, unknown>; error?: string; createdAt: string; updatedAt: string };
export const TaskSchema = { parse<T extends Task>(value: T): T { return value; } };
export type Run = { id: string; projectId: string; goal: string; workspace: string; status: RunStatus; strategy: Strategy; riskScore: number; requiresApproval: boolean; version: number; createdAt: string; updatedAt: string; completedAt?: string; error?: string; metrics?: { toolCalls: number; durationMs: number; estimatedCostUsd: number; tokens?: number; costSource?: string; humanReviewCostUsd?: number; totalEstimatedCostUsd?: number }; execution?: { provider: AgentExecutionResult["provider"]; model?: string; promptVersionId?: string; initialWorkspaceHash: string; initialWorkspaceFiles?: Record<string, string>; finalWorkspaceHash?: string; verificationCommand?: string; verificationExitCode?: number; decision?: string; costSource?: string } };
export const RunSchema = { parse<T extends Run>(value: T): T { return value; } };
export type AgentEvent = { id: string; runId: string; taskId?: string; type: string; timestamp: string; payload: Record<string, unknown>; hash: string; dedupeKey?: string };
export const EventSchema = { parse<T extends AgentEvent>(value: T): T { return value; } };
export type Artifact = { id: string; runId: string; taskId?: string; kind: "prompt" | "output" | "diff" | "test-report" | "review" | "verification" | "evaluation" | "manifest"; path: string; sha256: string; bytes: number; createdAt: string };
export const ArtifactSchema = { parse<T extends Artifact>(value: T): T { return value; } };
export type ApprovalRequest = { id: string; runId: string; taskId: string; status: "pending" | "approved" | "rejected"; reason: string; decidedBy?: string; decidedAt?: string };
export type PromptVersion = { id: string; role: AgentRole; version: number; content: string; parentId?: string; status: "draft" | "candidate" | "frozen" | "rejected"; evidence: string[]; createdAt: string };
export type StoreData = { runs: Run[]; tasks: Task[]; events: AgentEvent[]; artifacts: Artifact[]; approvals: ApprovalRequest[]; promptVersions: PromptVersion[]; evaluations: EvaluationRecord[] };
export type EvaluationRecord = { id: string; strategy: Strategy; split: "development" | "held-out"; outcomes: Array<{ caseId: string; success: boolean; reviewed: boolean; costUsd: number; toolCalls: number; recovered: boolean }>; createdAt: string };
export type AgentExecutionContext = { runId: string; taskId: string; goal: string; workspace: string; role: AgentRole; prompt: string; promptVersionId?: string; timeoutMs: number; maxAttempts: number; approvalRequired: boolean };
export type AgentExecutionResult = { provider: "codex-sdk" | "codex-cli" | "mock"; model?: string; promptVersionId?: string; sessionId: string; finalResponse: string; events: Array<{ type: string; payload: Record<string, unknown> }>; changedFiles: string[]; toolCalls: number; tokens?: number; durationMs: number; exitCode?: number; costSource?: string };
export type WorkspaceChange =
  | { kind: "added" | "changed" | "deleted"; path: string; sha256?: string }
  | { kind: "renamed"; from: string; to: string; sha256: string };
export type VerifierResult = { passed: boolean; command: string; stdout: string; stderr: string; exitCode: number; checkedFiles: string[]; unauthorizedFiles: string[]; deletedFiles?: string[]; missingFiles?: string[]; pathEscapes?: string[]; timedOut?: boolean; durationMs?: number; stateHash: string; changes?: WorkspaceChange[]; allowedPathRules?: string[] };

