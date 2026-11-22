export function createOrderService() {
  const orders = new Map();
  const seen = new Set();
  return {
    process(order) {
      if (seen.has(order.id)) { return; }
      seen.add(order.id);
      orders.set(order.id, { ...order, status: "committed" });
      return orders.get(order.id);
    },
    get(id) { return orders.get(id); },
    size() { return orders.size; }
  };
}
