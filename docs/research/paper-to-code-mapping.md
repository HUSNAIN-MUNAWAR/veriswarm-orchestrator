# Paper-to-code mapping

This mapping separates concepts implemented in this repository from concepts that remain planned or unevaluated.

| Research concept | VeriSwarm implementation | Evidence boundary |
| --- | --- | --- |
| READY separates workflow execution, oversight-policy selection, and held-out qualification | `packages/orchestration`, `packages/evaluation`, `scripts/run-benchmark.ts`, `reports/qualification-report.json` | Development executions are real isolated fixture runs; held-out families are declared but currently `NOT EVALUATED`. |
| READY qualifies a combined human–AI operating point using reliability, review burden, and cost | `packages/evaluation/src/index.ts`, run `metrics.humanReviewCostUsd`, `metrics.totalEstimatedCostUsd` | Cost is a documented tool-call proxy and review cost assumption, not provider billing or measured human labor. |
| CRM-Agent-Bench uses executable state/trajectory/policy contracts | `packages/evidence/src/verifier.ts`, `fixtures/order-service` | This is a repository-owned stateful fixture, not a CRM-Agent-Bench reproduction or score. |
| Worker claims are not proof of success | `packages/evidence/src/verifier.ts`, `verification.completed` events, evidence view | The independent verifier executes checks and enforces workspace-change scope. |
| Bounded, scoped agent execution | `packages/codex-adapter/src/index.ts`, `AgentExecutionContext`, per-run workspace creation | SDK execution uses workspace-write, disabled network search, bounded timeout, and explicit approval policy. |
| Human oversight and auditable decisions | `/api/approvals`, `FileStore.decideApproval`, approval UI, `approval.decided` events | Approval mutation is idempotency-guarded and requires confirmation in the UI. |

Primary sources: [READY or Not: Reliable Enterprise Agent Deployment](https://arxiv.org/abs/2609.02095) and [CRM-Agent-Bench](https://arxiv.org/abs/2610.32004).
