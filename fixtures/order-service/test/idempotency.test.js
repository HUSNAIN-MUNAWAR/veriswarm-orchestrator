import test from "node:test";
import assert from "node:assert/strict";
import { createOrderService } from "../src/orderService.js";

test("replaying an idempotency key returns the committed order", () => {
  const service = createOrderService();
  const order = { id: "ord-001", total: 42 };
  const first = service.process(order);
  const replay = service.process(order);
  assert.equal(first.status, "committed");
  assert.deepEqual(replay, first);
  assert.equal(service.size(), 1);
});
