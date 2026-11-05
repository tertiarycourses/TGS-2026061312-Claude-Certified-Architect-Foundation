// Validates an order line quantity before it reaches the repository.
export function validateQuantity(qty) {
  if (!Number.isInteger(qty)) throw new Error("quantity must be an integer");
  return qty;
}
