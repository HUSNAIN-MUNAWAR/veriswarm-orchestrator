# Reproducibility

## Environment

- Node.js with the repository lockfile.
- Python 3.12 plus Playwright/Pillow/imageio-ffmpeg only for browser media capture.
- Default provider: `VERISWARM_PROVIDER=mock`.
- Live Codex execution is opt-in and requires an authenticated, isolated checkout.

## Commands

```powershell
npm install
$env:VERISWARM_PROVIDER="mock"
npm test
npm run typecheck
npm run benchmark
npm run demo
npm run diagrams
npm run dev
```

The benchmark writes `BENCHMARK_REPORT.json` and the four JSON files under `reports/`. The demo writes fixture artifacts under `docs/demo/` and its isolated runtime data under `data/demo/`. `npm run showcase` regenerates browser screenshots and media, and writes the provider/truth manifest beside them.

## Reproduction claim

An independent researcher can reproduce the deterministic development experiment and inspect every generated record. They cannot yet reproduce a held-out enterprise qualification, CRM-Agent-Bench result, or live Codex result from the committed environment because those inputs are not present.
