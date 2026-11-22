# Evaluation methodology

The benchmark compares strategies over the same repository-owned task fixtures and records strict success, independent verification, review burden, tool-call proxy, cost estimate, and recovery. The development set is used for strategy/prompt decisions; held-out qualification is a separate split and must be frozen before evaluation.

Qualification uses a one-sided Wilson lower confidence bound. For a small sample, or when independence is not credible, the result is `inconclusive`. A qualified result means only: qualified for the tested task distribution, agent configuration, oversight policy, confidence level, and stated assumptions.

Run `npm run benchmark` to generate `BENCHMARK_REPORT.json`. The current fixture run has no held-out cases and therefore cannot support a deployment claim.
