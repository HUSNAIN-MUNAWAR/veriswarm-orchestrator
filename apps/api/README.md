# VeriSwarm API

The API is intentionally small and durable for the working slice. It stores runs, tasks, events, approvals, artifacts, prompt versions, and evaluation records in `data/veriswarm.json`; the orchestration interfaces are designed so a PostgreSQL/Redis store can replace this adapter without changing the workflow logic.
