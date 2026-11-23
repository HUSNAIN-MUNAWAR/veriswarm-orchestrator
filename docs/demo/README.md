# Reproducible demo evidence

Run `npm run demo` to execute the seeded order-service workflow in an isolated copied workspace. The command writes the authentic manifest, JSONL event stream, and measured metrics here, and keeps a run-local copy under `data/demo/`.

For browser evidence, run `npm run showcase`. The Playwright harness starts the API in mock mode, seeds the fixture and approval flows, asserts the control-plane UI, and writes:

- `docs/assets/screenshots/01-overview.png` through `11-mobile.png`
- `docs/assets/demo/veriswarm-demo.mp4`
- `docs/assets/demo/veriswarm-walkthrough.gif`
- `docs/assets/demo/demo-poster.png`
- `docs/assets/demo/capture-manifest.json`

The committed media is deterministic `MockAgentProvider` evidence. It is not live Codex evidence unless a separate manifest explicitly says so.
