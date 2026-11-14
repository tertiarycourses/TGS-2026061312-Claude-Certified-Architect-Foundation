import { test } from "node:test";
import assert from "node:assert";
import { subtotal } from "./cart.js";

test("subtotal adds items", () => {
  assert.equal(subtotal([{ priceCents: 250, qty: 2 }]), 500);
});
