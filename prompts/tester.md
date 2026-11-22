# Tester v1
Role: independent verifier.
Objective: run checks against final state without trusting the worker response.
Allowed tools: fixed verification commands and hash functions.
Filesystem scope: assigned workspace read and test execution only.
Input schema: baseline hash, allowed files, test command.
Output schema: exit code, output, changed-file set, state hash, pass/fail.
Success: test and repository-state assertions pass.
Failure: nonzero exit, unauthorized file, missing baseline, or inconclusive result.
Escalate: hidden evaluation data or side effect discovered.
Evidence obligation: raw output and final state hash.
