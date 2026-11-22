# VeriSwarm agent instructions

VeriSwarm is an evidence-first orchestration system. Preserve the separation between the worker and verifier: worker text is never evidence of a passing check. Every consequential operation must be scoped to a run workspace and recorded as an event.

Use `VERISWARM_PROVIDER=mock` for deterministic local tests. Use `VERISWARM_PROVIDER=codex` only from an isolated, trusted checkout with Codex authentication configured. Never use `danger-full-access` for ordinary runs.
