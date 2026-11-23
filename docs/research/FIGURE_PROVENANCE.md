# Figure provenance

Every committed visual is tied to a local source record, route, generated source, or capture command. Worker prose is never used as evidence of a passing check; where a figure says “verified,” the source is the persisted independent verifier event and its recorded hashes.

## Browser figures

| Figure | Page/state | Primary source | Evidence boundary |
| --- | --- | --- | --- |
| `01-overview.png` | Command center | `/api/overview`, `/api/runs`, `/api/health` | Counts and recent runs from the local file store; mock mode is visible |
| `02-live-execution.png` | Live execution mode | `/api/runs/:id` run/tasks/events | Shows a completed fixture snapshot and its persisted event sequence |
| `03-task-dag.png` | Task DAG mode | `/api/runs/:id` task `dependsOn`, `status`, `attempts` | Edges and nodes are rendered from stored task records |
| `04-agent-trace.png` | Agent trace mode | run `execution`, task `result`, event `hash`, `verification.completed` | Provider metadata is shown separately from verifier evidence |
| `05-approval-center.png` | Approval center | `/api/approvals?all=true` | Pending human gate is a persisted approval record |
| `06-prompt-lab.png` | Prompt lab | `/api/prompts` | Prompt IDs and hashes come from immutable prompt records |
| `07-evaluation-lab.png` | Evaluation lab | `/api/evaluation`, `reports/*.json` | Development comparison only; held-out status is `NOT EVALUATED` |
| `08-architecture.png` | Architecture explorer | `docs/architecture/*.md` and runtime component map | Proposed infrastructure is labelled separately from implemented components |
| `09-reproducibility.png` | Reproducibility | `/api/evaluation` and repository reports | Commands, provider, split, and limits are displayed as an experiment contract |
| `10-evidence-inspector.png` | Evidence explorer | `/api/runs/:id` artifacts and `verification.completed` | Artifact hashes and verifier payload are persisted records |
| `11-mobile.png` | Responsive command center | Same API-backed command center at 390px width | Layout evidence only; it does not add experimental evidence |

The exact SHA-256 for each image, its intent, capture run ID, provider, and capture timestamp are in [`../assets/demo/capture-manifest.json`](../assets/demo/capture-manifest.json). The capture script rejects duplicate hashes for the three formerly-colliding focus figures.

## Walkthrough media

| Asset | Source | Intended use |
| --- | --- | --- |
| `veriswarm-walkthrough.gif` | Same Playwright Chromium session, first 12 seconds | Compact README preview; deterministic mock evidence |
| `veriswarm-demo.mp4` | Same session, full recorded route sequence | Complete 60–90 second research walkthrough |
| `demo-poster.png` | Frame at three seconds from the MP4 source | Static preview/poster |

The media paths and measured durations are manifest fields, not hand-entered claims. Recreate them with `npm run showcase` after installing the documented Playwright and FFmpeg prerequisites.

## Architecture figures

The SVGs in `docs/assets/architecture/` are generated from the Mermaid source files in `docs/architecture/` by `npm run diagrams`. Their provenance is source-to-render, not an experimental result. The architecture set documents the implemented local control plane, the independent verifier boundary, and proposed production infrastructure where explicitly marked.

## Research-result linkage

The visual evidence is deliberately adjacent to the machine-readable research package:

- `reports/execution-results.json` records actual isolated development executions.
- `reports/strategy-comparison.json` records the five-strategy comparison.
- `reports/reliability-evaluation.json` records review, recovery, cost, and workspace-hash fields.
- `reports/qualification-report.json` records the conditional lower bound and `NOT EVALUATED` held-out status.
- `docs/research/methodology.md`, `reliability-analysis.md`, `threats-to-validity.md`, and `reproducibility.md` explain what those records can and cannot support.

