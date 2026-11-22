import type { Outcome } from "./index.ts";
import type { Strategy } from "../../contracts/src/index.ts";

export const fixtureCases = Array.from({ length: 12 }, (_, index) => ({ id: `order-idempotency-${index + 1}`, goal: "Fix duplicate order processing while preserving the committed order state." }));

export function fixtureEvaluation(): Record<Strategy, Outcome[]> {
  const strategies: Strategy[] = ["single-worker", "planner-worker", "reviewed-worker", "parallel-adjudicated", "risk-adaptive"];
  return Object.fromEntries(strategies.map((strategy) => [strategy, fixtureCases.map((item, index) => ({ caseId: item.id, success: strategy === "single-worker" ? index !== 2 : true, reviewed: ["reviewed-worker", "parallel-adjudicated", "risk-adaptive"].includes(strategy), costUsd: strategy === "single-worker" ? 0.012 : strategy === "planner-worker" ? 0.02 : 0.034, toolCalls: strategy === "single-worker" ? 2 : strategy === "planner-worker" ? 3 : 5, recovered: index === 2 && strategy !== "single-worker" }))])) as Record<Strategy, Outcome[]>;
}
