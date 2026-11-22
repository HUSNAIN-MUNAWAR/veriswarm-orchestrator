# Implementation plan

## Delivered vertical slice

- Durable file-backed run/task/event store with optimistic versioning.
- Explicit workflow state machine and dependency-aware scheduler.
- Real `@openai/codex-sdk` adapter plus deterministic mock provider.
- Independent verifier that executes checks and records hashes.
- Evidence explorer API and control-plane UI.
- Prompt versions, strategy comparison, and one-sided qualification calculations.
- Order-service bug fixture and reproducible demo/benchmark scripts.
- Mermaid architecture sources and rendered-friendly README references.

## Follow-up work

- Replace file store with PostgreSQL/Redis in a deployment profile.
- Add authenticated multi-tenant identity and OpenTelemetry exporters.
- Run the Codex smoke test in a trusted environment with an authenticated model.
- Capture Playwright/FFmpeg media after a live run; this environment has no Python or browser recorder configured.
