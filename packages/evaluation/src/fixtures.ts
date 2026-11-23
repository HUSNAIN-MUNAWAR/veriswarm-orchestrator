export type TaskSuiteCase = { id: string; family: string; split: "development" | "held-out"; status: "evaluated" | "not-evaluated"; fixturePath?: string; goal: string; allowedChangedFiles?: string[] };

export const fixtureCases: TaskSuiteCase[] = Array.from({ length: 12 }, (_, index) => ({ id: `order-idempotency-${index + 1}`, family: "idempotency", split: "development", status: "evaluated", fixturePath: "fixtures/order-service", goal: "Fix duplicate order processing while preserving the committed order state.", allowedChangedFiles: ["src/orderService.js"] }));

export const taskSuite: TaskSuiteCase[] = [...fixtureCases, ...[
  ["concurrency-race", "Concurrency race handling"],
  ["authorization-policy", "Authorization policy enforcement"],
  ["api-correctness", "API contract correctness"],
  ["workflow-state", "Workflow state transition regression"],
  ["data-consistency", "Data consistency failure"],
  ["failure-recovery", "Failure recovery scenario"],
  ["workspace-scope", "Unexpected workspace modification"],
].map(([id, goal]) => ({ id: `heldout-${id}`, family: id, split: "held-out" as const, status: "not-evaluated" as const, goal: `Evaluate ${goal.toLowerCase()} under an isolated enterprise fixture.` }))];
