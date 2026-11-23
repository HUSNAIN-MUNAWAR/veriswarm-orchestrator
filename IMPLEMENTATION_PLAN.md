# Implementation plan

## Delivered and validated

- [x] Durable file-backed run/task/event/approval/artifact/prompt/evaluation store.
- [x] Explicit workflow state machine, dependency-aware scheduler, bounded retries, cancellation, and approval resume/reject behavior.
- [x] Real `@openai/codex-sdk` adapter with a deterministic mock adapter for offline and CI execution.
- [x] Generic independent verifier with executable checks, workspace hashing, unauthorized-change/deletion/rename detection, missing outputs, timeouts, and path-escape guards.
- [x] Backend-driven control plane with overview, live DAG, event trace, approvals, prompts, evaluation, evidence, architecture, and reproducibility views.
- [x] Approval-gated run creation and persisted decision history, including explicit confirmation before mutation.
- [x] Actual isolated benchmark runner with five distinct scheduler DAGs, 60 development executions, review/cost/recovery metrics, and explicit held-out `NOT EVALUATED` status.
- [x] Playwright Chromium browser smoke/capture harness with UI assertions and eleven committed screenshots.
- [x] 72-second MP4 research walkthrough, 12-second GIF, poster, and truth-labelled capture manifest generated from the browser session.
- [x] Research evidence package under `docs/research/` and machine-readable reports under `reports/`.
- [x] Mermaid sources rendered to committed SVG architecture assets with a repeatable `npm run diagrams` command.
- [x] README, demo guide, blocker conditions, and UI truth labels rebuilt around the actual implementation state.
- [x] TypeScript typecheck, 13 integration/regression tests, actual benchmark, and browser capture completed successfully.

## Deliberately not claimed

- [ ] Successful live Codex qualification without an authenticated runtime.
- [ ] Held-out task-family execution and statistical qualification.
- [ ] Demonstrated concurrent parallel adjudication.
- [ ] Production PostgreSQL/Redis deployment, identity, multi-tenancy, or telemetry exporters.
- [ ] Python evaluator parity or a CRM-Agent-Bench score.
- [ ] Public hosted application deployment.

## Next engineering slice

- Replace the file store with PostgreSQL and move scheduling/leases to Redis or a durable queue.
- Add authenticated multi-tenant identity and OpenTelemetry exporters.
- Run a trusted live Codex smoke test and retain its evidence separately from mock fixture media.
- Expand the held-out benchmark suite and add statistical power planning.
