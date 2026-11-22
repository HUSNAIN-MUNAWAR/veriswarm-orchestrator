import test from "node:test";
import assert from "node:assert/strict";
import { qualify, wilsonLowerBound } from "../packages/evaluation/src/index.ts";

test("qualification is inconclusive for small samples", () => { assert.equal(qualify([{ caseId: "1", success: true, reviewed: false, costUsd: 1, toolCalls: 1, recovered: false }]).decision, "inconclusive"); });
test("lower bound stays below observed rate for imperfect samples", () => { assert.ok(wilsonLowerBound(9, 10) < 0.9); });
