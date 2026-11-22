# Order service fixture

This tiny, independently owned repository intentionally contains an idempotency regression: a replay is ignored instead of returning the already committed order. The VeriSwarm worker changes only `src/orderService.js`; the verifier runs `node --test test/idempotency.test.js` itself and enforces the allowed-file boundary.
