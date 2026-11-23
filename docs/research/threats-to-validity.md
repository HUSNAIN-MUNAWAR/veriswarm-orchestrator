# Threats to validity

- **Provider validity:** committed experiments use a deterministic mock provider, not an authenticated live Codex model.
- **Task validity:** only one evaluated task family exists; repeated isolated seeds do not represent the seven declared held-out families.
- **Independence:** case copies are independent workspaces, but the fixture logic is nearly identical across development cases.
- **Cost validity:** cost is estimated from tool-call count and a configured proxy, not provider invoices.
- **Human oversight validity:** review rate is measured from the task graph; review effectiveness and human labor cost are not measured.
- **Statistical validity:** the Wilson interval describes the finite development sample; with no held-out set, it cannot support deployment qualification.
- **Parallelism validity:** the parallel-adjudicated strategy now has two distinct review roles in the DAG, but the local scheduler executes ready tasks sequentially; it is not evidence of concurrent execution.
- **Verifier validity:** the generic verifier covers command results, scope, missing files, deletion, rename, timeout, and path-escape cases, but the fixture assertions remain specialized.
