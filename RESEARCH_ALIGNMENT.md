# Research alignment

VeriSwarm is an independent implementation and does not claim affiliation with OpenAI, Scale AI, or Salesforce.

| Source | Adopted idea | Implementation boundary |
| --- | --- | --- |
| READY, arXiv:2609.02095 | Separate execution, evaluation, oversight policy selection, and held-out qualification; report one-sided reliability bounds. | `packages/evaluation/src/index.ts` performs this on fixture outcomes. It reports inconclusive when evidence is insufficient. |
| CRM-Agent-Bench | Stateful tasks need repository/data-state assertions instead of only answer text. | `fixtures/order-service` plus verifier assertions model this pattern; a benchmark adapter is intentionally not claimed without the external benchmark checkout. |
| Codex SDK documentation | Programmatic threads are the primary worker integration; `codex exec --json` is a fallback diagnostic. | `packages/codex-adapter/src/index.ts` uses `Codex.startThread().run()` and records thread/session metadata. |
| Codex as a Platform | The application owns workflow state, scoped context, approvals, and evidence around the agent loop. | API, policy checks, approval endpoint, and evidence store surround the adapter. |
| Codex non-interactive mode | JSONL execution events are machine-readable and sandbox choice must be explicit. | Adapter supports CLI fallback and records raw event lines; default policy is workspace-write, never full host access. |

## Original extension: evidence-aware strategy selection

The scheduler selects a strategy from risk, prior failure rate, estimated cost, and verification availability. The included comparison is a hypothesis harness, not a claim of novel research. Results are qualified only for the tested fixture distribution and configuration.
