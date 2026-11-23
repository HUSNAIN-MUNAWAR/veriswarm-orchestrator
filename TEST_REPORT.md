# Test report

The current suite contains 12 passing tests covering deterministic orchestration, retry/recovery, approval resume and duplicate decisions, state transitions, DAG validation, independent verification, unauthorized edits, deletions, renames, missing outputs, path escapes, and timeouts.

The mock provider is intentionally deterministic. It is not evidence that the Codex provider succeeded. A live smoke test is opt-in via `VERISWARM_PROVIDER=codex npm run demo` and must be run in an authenticated isolated workspace.
