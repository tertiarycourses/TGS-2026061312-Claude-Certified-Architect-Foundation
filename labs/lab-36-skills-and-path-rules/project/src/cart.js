// Cart totals. Prices arrive in cents.
export function subtotal(items) {
  return items.reduce((sum, i) => sum + i.priceCents * i.qty, 0);
}

export function applyDiscount(totalCents, percent) {
  // BUG on purpose: converts to dollars and back with floating point
  const dollars = totalCents / 100;
  return Math.round(dollars * (1 - percent / 100) * 100) / 100;
}
