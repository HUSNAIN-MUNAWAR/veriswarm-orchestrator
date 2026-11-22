import type { EvaluationRecord, Strategy } from "../../contracts/src/index.ts";

export type Outcome = EvaluationRecord["outcomes"][number];

export function wilsonLowerBound(successes: number, trials: number, confidence = 0.95): number {
  if (trials === 0) return 0;
  const z = confidence >= 0.99 ? 2.576 : confidence >= 0.95 ? 1.96 : 1.645;
  const p = successes / trials; const denominator = 1 + (z * z) / trials; const centre = p + (z * z) / (2 * trials); const spread = z * Math.sqrt((p * (1 - p) / trials) + (z * z) / (4 * trials * trials));
  return Math.max(0, (centre - spread) / denominator);
}

export function compareStrategies(outcomes: Record<Strategy, Outcome[]>): Array<{ strategy: Strategy; successRate: number; reviewRate: number; costUsd: number; toolCalls: number }> {
  return (Object.entries(outcomes) as Array<[Strategy, Outcome[]]>).map(([strategy, items]) => ({ strategy, successRate: items.length ? items.filter((item) => item.success).length / items.length : 0, reviewRate: items.length ? items.filter((item) => item.reviewed).length / items.length : 0, costUsd: items.reduce((sum, item) => sum + item.costUsd, 0), toolCalls: items.reduce((sum, item) => sum + item.toolCalls, 0) }));
}

export function qualify(outcomes: Outcome[], target = 0.9, confidence = 0.95): { decision: "qualified" | "not-qualified" | "inconclusive"; observedRate: number; lowerBound: number; reason: string } {
  if (outcomes.length < 10) return { decision: "inconclusive", observedRate: 0, lowerBound: 0, reason: "At least 10 independent cases are required for this engineering harness." };
  const successes = outcomes.filter((item) => item.success).length; const observedRate = successes / outcomes.length; const lowerBound = wilsonLowerBound(successes, outcomes.length, confidence);
  if (lowerBound >= target) return { decision: "qualified", observedRate, lowerBound, reason: "The one-sided lower confidence bound meets the configured target." };
  return { decision: "not-qualified", observedRate, lowerBound, reason: "The one-sided lower confidence bound does not meet the configured target." };
}
