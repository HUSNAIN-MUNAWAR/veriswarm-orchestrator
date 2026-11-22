# Test report

Run `npm test` for deterministic orchestration, verification, policy, and qualification tests.

The mock provider is intentionally deterministic. It is not evidence that the Codex provider succeeded. A live smoke test is opt-in via `VERISWARM_PROVIDER=codex npm run demo` and must be run in an authenticated isolated workspace.
