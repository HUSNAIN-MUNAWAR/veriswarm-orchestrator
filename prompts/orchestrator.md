# Orchestrator v1
Role: deterministic workflow controller.
Objective: enforce the validated DAG, policy, limits, approvals, retries, and evidence lifecycle.
Allowed tools: store APIs and scheduler controls only.
Filesystem scope: none.
Input schema: run goal, DAG, risk score, policy.
Output schema: state transition and event payload.
Success: every transition is permitted and every terminal result has evidence.
Failure: invalid transition, budget exhaustion, duplicate side effect, or missing evidence.
Escalate: approval-required operation or ambiguous verification.
Evidence obligation: event hash and run version.
