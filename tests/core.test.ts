import { test } from "node:test";
import assert from "node:assert/strict";
import { phone, message, transitions, hash } from "../lib/core";
import { sendWhatsApp } from "../lib/fonnte";
test("normalize Indonesian phones and reject invalid destinations", () => {
  assert.equal(phone("0812-3456-7890"), "6281234567890");
  assert.equal(phone("+62 81234567890"), "6281234567890");
  assert.throws(() => phone("123"));
});
test("terminal status cannot advance", () => {
  assert.deepEqual(transitions.CANCELLED, []);
  assert.deepEqual(transitions.COMPLETED, []);
  assert(!transitions.PENDING.includes("COMPLETED"));
});
test("notification distinguishes received order from payment verification", () => {
  const o = {
    name: "Rani",
    code: "BB-TEST",
    total: 30000,
    delivery: "PICKUP",
    location: "Veteran Gang 9",
  };
  assert.match(
    message(o, "CREATED", "https://example.com"),
    /menunggu konfirmasi/,
  );
  assert.match(message(o, "READY", "https://example.com"), /Veteran Gang 9/);
  assert.match(
    message(o, "CANCELLED", "https://example.com", "PO batal"),
    /pengembalian dana/,
  );
  assert.equal(hash("token").length, 64);
});
test("disabled integration never contacts provider", async () => {
  process.env.WHATSAPP_ENABLED = "false";
  assert.equal((await sendWhatsApp("6281234567890", "test")).state, "BLOCKED");
});
test("Fonnte acceptance, rejection and uncertain network result", async () => {
  const original = global.fetch;
  process.env.WHATSAPP_ENABLED = "true";
  process.env.FONNTE_TOKEN = "test-only";
  try {
    global.fetch = async () =>
      new Response(JSON.stringify({ status: true, id: ["123"] }));
    assert.equal((await sendWhatsApp("6281234567890", "test")).state, "SENT");
    global.fetch = async () => new Response(JSON.stringify({ status: false }));
    assert.equal(
      (await sendWhatsApp("6281234567890", "test")).state,
      "BLOCKED",
    );
    global.fetch = async () => {
      throw Error("timeout");
    };
    assert.equal(
      (await sendWhatsApp("6281234567890", "test")).state,
      "UNKNOWN",
    );
  } finally {
    global.fetch = original;
    delete process.env.FONNTE_TOKEN;
    process.env.WHATSAPP_ENABLED = "false";
  }
});
