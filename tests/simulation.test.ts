import { test } from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { simulationDocument } from "../lib/simulation-document";
import { simulationDraftInput } from "../lib/simulation-schema";
function simulator() {
  const elements: Record<string, any> = {};
  const el = (id: string) =>
    (elements[id] ??= {
      value: "",
      textContent: "",
      innerHTML: "",
      addEventListener() {},
      classList: { add() {}, remove() {}, toggle() {} },
    });
  const ctx = vm.createContext({
    document: { getElementById: el, querySelectorAll: () => [] },
    setTimeout: () => 0,
    clearTimeout() {},
    fetch: async () => ({ ok: true, json: async () => [] }),
    scrollTo() {},
    confirm: () => true,
    console,
  });
  const source = simulationDocument.match(/<script>([\s\S]*?)<\/script>/)![1];
  vm.runInContext(source, ctx);
  return ctx;
}
test("uploaded simulator aggregates shared stocks only once", () => {
  const ctx = simulator();
  vm.runInContext("loadExample();lastResult=calculate()", ctx);
  assert.equal(vm.runInContext("lastResult.pcs", ctx), 70);
  assert.equal(
    vm.runInContext("lastResult.rows.find(r=>r.name==='Susu').need", ctx),
    3100,
  );
  assert.equal(
    vm.runInContext("lastResult.rows.find(r=>r.name==='Susu').shortage", ctx),
    1600,
  );
  assert.equal(
    vm.runInContext("lastResult.rows.find(r=>r.name==='Gabin').remaining", ctx),
    60,
  );
  assert.equal(vm.runInContext("lastResult.short", ctx), 2);
});
test("simulator rejects mixed units and invalid quantities", () => {
  const ctx = simulator();
  vm.runInContext("loadExample();variants[1].ingredients[1].unit='L'", ctx);
  assert.match(vm.runInContext("validate(readForm())", ctx), /satuan berbeda/);
  vm.runInContext("variants[0].qty=0", ctx);
  assert.match(vm.runInContext("validate(readForm())", ctx), /lebih dari 0/);
});
test("CSV escapes formulas in free-text input", () => {
  assert.equal(vm.runInContext("csvCell('=1+1')", simulator()), '"\'=1+1"');
});
test("server validates recipe and shared stock before saving", () => {
  const ctx = simulator();
  vm.runInContext("loadExample()", ctx);
  const input = JSON.parse(vm.runInContext("JSON.stringify(readForm())", ctx));
  assert(simulationDraftInput.safeParse(input).success);
  input.variants[1].ingredients[1].stock = 7;
  assert(!simulationDraftInput.safeParse(input).success);
});
