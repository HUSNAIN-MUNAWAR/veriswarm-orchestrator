# Benchmark report

`npm run benchmark` executes the repository-owned development cases through the durable scheduler and independent verifier. The current generated report contains 60 actual isolated executions: 12 idempotency cases across five strategies. It records success, review burden, recovery events, tool-call proxy, estimated cost, provider identity, and workspace hashes.

Seven held-out task families are declared in the task suite but are explicitly `NOT EVALUATED`. The report therefore cannot support deployment qualification. See [`reports/`](reports), [`docs/research/reliability-analysis.md`](docs/research/reliability-analysis.md), and [`BENCHMARK_REPORT.json`](BENCHMARK_REPORT.json).
