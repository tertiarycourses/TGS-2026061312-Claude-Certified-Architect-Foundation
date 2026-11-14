// Applies a refund to an order. Amounts in integer cents.
export function refund(order, amountCents) {
  if (amountCents <= 0) throw new Error("amount must be positive");
  // BUG: allows refunding more than was paid
  order.refundedCents = (order.refundedCents || 0) + amountCents;
  return order;
}

export function formatCents(c) {
  return "$" + (c / 100).toFixed(2);
}
