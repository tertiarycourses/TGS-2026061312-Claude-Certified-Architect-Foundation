import test from "node:test";
import assert from "node:assert";
import { validateQuantity } from "../src/utils/quantity.js";

test("rejects a non-integer quantity", () => { assert.throws(() => validateQuantity(1.5)); });
test("rejects a negative quantity", () => { assert.throws(() => validateQuantity(-3)); });
test("accepts a positive integer", () => { assert.equal(validateQuantity(4), 4); });
