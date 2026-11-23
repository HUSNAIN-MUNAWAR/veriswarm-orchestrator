# Visual evidence audit

## Scope

This audit covers the committed Playwright capture under `docs/assets/screenshots/` and the walkthrough media under `docs/assets/demo/`. The capture uses the local control plane with `VERISWARM_PROVIDER=mock`; it is deterministic fixture evidence, not a live Codex run.

## Duplicate-evidence defect and repair

The original capture script navigated to **Live execution**, took `02-live-execution.png`, checked that the event timeline existed, and then took `03-task-dag.png` and `04-agent-trace.png` without changing the page state. The three files therefore had the same SHA-256 and did not support three separate visual claims.

The repair adds three explicit, data-backed modes inside the Live execution view:

| Screenshot | Intended evidence | Persisted source | Distinguishing UI state |
| --- | --- | --- | --- |
| `02-live-execution.png` | Workflow state transitions | `/api/runs/:id` run, tasks, and events | Live execution mode; stage strip and state transition log |
| `03-task-dag.png` | Dependency structure and task states | `/api/runs/:id` task records and `dependsOn` fields | Task DAG mode; graph plus DAG ledger |
| `04-agent-trace.png` | Provider/tool provenance and independent decision | run execution record, task results, event hashes, `verification.completed` | Agent trace mode; provider/model/prompt/session/workspace fields and verifier record |

The capture now selects each mode, asserts its screen heading, and fails if the three SHA-256 values are not distinct. The current values are recorded in [`../assets/demo/capture-manifest.json`](../assets/demo/capture-manifest.json).

## Storyline coverage

The media sequence is intentionally ordered as:

1. Command center and truth banner.
2. Live execution state transitions.
3. Planned task DAG and dependency edges.
4. Agent trace, provider metadata, tool events, workspace hashes, and independent verification.
5. Approval interruption.
6. Versioned prompts and evaluation boundary.
7. Architecture, reproducibility contract, and evidence inspector.

This presents the evidence chain as **Task → Agent → Artifact → Independent Verification → Qualification**. The approval-gated seed demonstrates the interruption boundary. Retry/recovery is implemented and tested in the scheduler, but this single deterministic walkthrough does not claim a transient provider failure occurred in the captured run.

## Validation performed

The reproducible command is:

```powershell
$env:VERISWARM_PROVIDER="mock"
npm run showcase
```

The script validates all eleven screenshots, browser console errors, the mode headings, media output, and the identity condition for `02/03/04`. The current manifest records an approximately 70-second MP4 and a 12-second GIF. The GIF is the README preview; the MP4 is the complete walkthrough.

## Truth conditions

- The captured run is from `MockAgentProvider` and is labelled **DEMO MODE — DETERMINISTIC MOCK PROVIDER** in the UI.
- The research benchmark behind the evaluation view contains 60 actual development executions across five strategies and 12 development seeds.
- Seven declared held-out task families remain `NOT EVALUATED`.
- The visual evidence demonstrates persisted orchestration, approval, verification, and provenance behavior. It does not establish general reliability, live Codex performance, CRM-Agent-Bench performance, or production qualification.
- Cost values are the recorded mock/tool-call proxy, not provider billing.

