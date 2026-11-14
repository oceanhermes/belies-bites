import { test } from "node:test";
import assert from "node:assert/strict";
import {
  quotaInput,
  remainingQuota,
  summarizeUsage,
  assertCapacity,
} from "../lib/quota";
test("quota distinguishes unlimited and sold out", () => {
  assert.equal(remainingQuota(null, 99), null);
  assert.equal(remainingQuota(0, 0), 0);
  assert.equal(remainingQuota(10, 3), 7);
  assert.equal(remainingQuota(2, 3), 0);
  assert(quotaInput.safeParse(null).success);
  assert(!quotaInput.safeParse(-1).success);
  assert(!quotaInput.safeParse(1.5).success);
});
test("existing JSON orders contribute quantities across variants", () => {
  assert.deepEqual(
    summarizeUsage([
      {
        items: [
          { id: "a", quantity: 3 },
          { id: "b", quantity: 2 },
        ],
      },
      { items: [{ id: "a", quantity: 1 }] },
    ]),
    { total: 6, menus: { a: 4, b: 2 } },
  );
});
test("capacity accepts exact final box and rejects oversell", () => {
  assert.doesNotThrow(() => assertCapacity(10, 8, 2, "batch"));
  assert.throws(() => assertCapacity(10, 8, 3, "batch"), /Sisa 2 box/);
  assert.doesNotThrow(() => assertCapacity(null, 100, 50, "batch"));
  assert.throws(() => assertCapacity(0, 0, 1, "varian"), /Sisa 0 box/);
});
