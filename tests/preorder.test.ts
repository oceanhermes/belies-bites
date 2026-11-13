import { test } from "node:test";
import assert from "node:assert/strict";
import { preorderInput, wibToISO, wibDate } from "../lib/preorder";
test("WIB form converts consistently across browser timezones", () => {
  assert.equal(wibToISO("2026-11-13", "08:00"), "2026-11-13T01:00:00.000Z");
  assert.equal(wibDate(new Date("2026-11-13T23:00:00Z")), "2026-11-14");
});
test("invalid or missing dates produce friendly errors", () => {
  assert.throws(() => wibToISO("", "08:00"), /Lengkapi/);
  assert.throws(() => wibToISO("2026-02-30", "08:00"), /tidak valid/);
});
test("batch validation rejects short name, equal times and reversed range", () => {
  const good = {
    title: " Batch 02 ",
    startsAt: "2026-11-13T01:00:00.000Z",
    closesAt: "2026-11-14T13:00:00.000Z",
  };
  assert.equal(preorderInput.parse(good).title, "Batch 02");
  assert(!preorderInput.safeParse({ ...good, title: "A" }).success);
  assert(
    !preorderInput.safeParse({ ...good, closesAt: good.startsAt }).success,
  );
  assert(
    !preorderInput.safeParse({
      ...good,
      startsAt: good.closesAt,
      closesAt: good.startsAt,
    }).success,
  );
});
