import test from "node:test";
import assert from "node:assert/strict";
import { assertAcyclic, assertTransition, canTransition } from "../packages/orchestration/src/state-machine.ts";

test("state machine permits only declared transitions", () => { assert.equal(canTransition("created", "planned"), true); assert.equal(canTransition("completed", "running"), false); assert.throws(() => assertTransition("completed", "running"), /Invalid run transition/); });
test("DAG validation rejects cycles and unknown dependencies", () => { assert.doesNotThrow(() => assertAcyclic([{ id: "a", dependsOn: [] }, { id: "b", dependsOn: ["a"] }])); assert.throws(() => assertAcyclic([{ id: "a", dependsOn: ["b"] }, { id: "b", dependsOn: ["a"] }]), /cycle/); assert.throws(() => assertAcyclic([{ id: "a", dependsOn: ["missing"] }]), /Unknown dependency/); });
