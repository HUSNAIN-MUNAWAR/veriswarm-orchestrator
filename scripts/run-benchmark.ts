import { fixtureEvaluation } from "../packages/evaluation/src/fixtures.ts";
import { compareStrategies, qualify } from "../packages/evaluation/src/index.ts";
import { writeFile } from "node:fs/promises";
const outcomes = fixtureEvaluation(); const comparison = compareStrategies(outcomes); const qualification = qualify(outcomes["risk-adaptive"], 0.9, 0.95); const report = { generatedAt: new Date().toISOString(), dataset: "repository-owned order idempotency fixtures", developmentCases: 12, heldOutCases: 0, comparison, qualification, limitations: ["synthetic fixture", "no CRM-Agent-Bench checkout", "held-out set intentionally not used for policy selection"] }; await writeFile("BENCHMARK_REPORT.json", JSON.stringify(report, null, 2)); console.log(JSON.stringify(report, null, 2));
