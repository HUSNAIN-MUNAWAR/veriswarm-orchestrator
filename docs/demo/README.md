# Reproducible demo evidence

Run `npm run demo` to execute the seeded order-service workflow in an isolated copied workspace. The command writes the current authentic manifest, JSONL event stream, and measured metrics here, and also keeps a run-local copy under `data/demo/`.

The committed files are generated from the mock fixture run. They are not live Codex evidence unless their manifest says `CodexSdkProvider` or `CodexCliProvider`. Browser screenshots are captured separately from the running UI by `scripts/capture_browser_evidence.py`; they remain mock-provider evidence. `veriswarm-demo.mp4` and `demo-poster.png` are intentionally not present because no video capture was performed.
