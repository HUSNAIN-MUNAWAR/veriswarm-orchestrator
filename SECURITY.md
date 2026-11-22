# Security model

- Real workers receive a per-run temporary workspace and an allowlisted working directory.
- The SDK uses `workspace-write`, disabled web search/network access, bounded timeouts, and an explicit approval policy.
- The verifier compares final files against a baseline and fails on unauthorized modifications.
- Worker text is untrusted input; tests and state assertions are executed independently.
- Events and artifacts carry hashes for audit lineage.
- Secrets are redacted by deployment configuration; no credentials belong in the repository.
- Public HTTP authentication and multi-tenant authorization are not implemented in this local slice. Do not expose the API to an untrusted network.
