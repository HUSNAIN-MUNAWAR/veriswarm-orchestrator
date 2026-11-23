# Reliability analysis

The current generated report contains the following development-only operating points:

| Strategy | Verified success | Review rate | Estimated total cost | Tool calls |
| --- | ---: | ---: | ---: | ---: |
| single-worker | 100% | 0% | $0.432 | 36 |
| planner-worker | 100% | 0% | $0.432 | 36 |
| reviewed-worker | 100% | 100% | $0.816 | 48 |
| parallel-adjudicated | 100% | 100% | $1.200 | 60 |
| risk-adaptive | 100% | 100% | $0.816 | 48 |

These are measured scheduler/verifier outcomes from the committed report, not model benchmark scores. The one-sided lower bound for the 12 development cases is 75.75%, but the result status is `NOT EVALUATED` because no held-out cases were run. The cost is a tool-call proxy; no provider billing or human review time was measured.

The implementation therefore demonstrates a functioning evidence and oversight framework, not a claim that multi-agent execution improves general coding reliability.
