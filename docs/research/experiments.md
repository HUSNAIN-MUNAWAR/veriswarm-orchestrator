# Experiments

The latest generated experiment package is machine-readable in [`../../reports`](../../reports):

- [`execution-results.json`](../../reports/execution-results.json) — one record per isolated strategy/case execution.
- [`strategy-comparison.json`](../../reports/strategy-comparison.json) — aggregates derived from those records.
- [`reliability-evaluation.json`](../../reports/reliability-evaluation.json) — confidence-bound evaluation.
- [`qualification-report.json`](../../reports/qualification-report.json) — explicit held-out qualification status.

The current run used `MockAgentProvider` for 60 development executions across 12 independent workspace copies. All five strategies completed the evaluated fixture family. The comparison is useful for workflow cost/review behavior, but it does not demonstrate model capability improvement because the provider and task family are deterministic.
