# Architecture sources and renders

The `.mmd` files are the source of truth for the current implementation. They intentionally show the file-backed development profile and PostgreSQL target schema rather than implying that Redis, Kubernetes, or a cloud service is already deployed.

Rendered SVGs are committed in [`../assets/architecture`](../assets/architecture). Regenerate them with:

```powershell
npm run diagrams
```

The renderer uses Playwright Chromium and Mermaid ESM. Set `VERISWARM_MERMAID_URL` to a locally hosted Mermaid module for offline operation.
