// Run only against an isolated test database/app, never production.
const assert = require("node:assert/strict");
const base = process.env.TEST_APP_URL || "http://localhost:3005";
let cookie = "";
async function api(p, method = "GET", body) {
  const r = await fetch(base + "/api/" + p, {
    method,
    headers: {
      Origin: base,
      ...(cookie ? { Cookie: cookie } : {}),
      ...(body && !(body instanceof FormData)
        ? { "Content-Type": "application/json" }
        : {}),
    },
    body:
      body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
  });
  if (r.headers.get("set-cookie"))
    cookie = r.headers.get("set-cookie").split(";")[0];
  return { status: r.status, data: await r.json() };
}
let po;
let seq = 0;
async function order(menu, quantity, key = crypto.randomUUID()) {
  const f = new FormData();
  f.set(
    "data",
    JSON.stringify({
      name: "Quota test",
      phone: "081234567" + String(++seq).padStart(3, "0"),
      payment: "CASH",
      delivery: "PICKUP",
      location: "Veteran Gang 9",
      notes: "test",
      consent: true,
      requestKey: key,
      items: [{ id: menu, quantity }],
    }),
  );
  return api("orders", "POST", f);
}
async function patch(id, body) {
  return api(id, "PATCH", body);
}
(async () => {
  const email = process.env.TEST_ADMIN_EMAIL,
    password = process.env.TEST_ADMIN_PASSWORD;
  if (!email || !password)
    throw Error(
      "Set TEST_ADMIN_EMAIL and TEST_ADMIN_PASSWORD for isolated test admin",
    );
  assert.equal(
    (await api("admin/login", "POST", { email, password })).status,
    200,
  );
  po = (
    await api("admin/preorders", "POST", {
      title: "Quota integration " + Date.now(),
      startsAt: new Date(Date.now() - 60000).toISOString(),
      closesAt: new Date(Date.now() + 3600000).toISOString(),
      quota: 10,
    })
  ).data;
  const a = (
      await api("admin/menus", "POST", {
        preorderId: po.id,
        name: "Varian A",
        description: "test",
        price: 15000,
        quota: 5,
      })
    ).data,
    b = (
      await api("admin/menus", "POST", {
        preorderId: po.id,
        name: "Varian B",
        description: "test",
        price: 18000,
        quota: null,
      })
    ).data;
  assert.equal(
    (await patch("admin/preorders/" + po.id, { active: true })).status,
    200,
  );
  // Same-variant race: both request 3 of only 5 available.
  const races = await Promise.all([order(a.id, 3), order(a.id, 3)]);
  assert.equal(
    races.filter((r) => r.status === 201).length,
    1,
    JSON.stringify(races),
  );
  let active = (await api("preorders/active")).data.preorder;
  assert.equal(active.used, 3);
  assert.equal(active.remaining, 7);
  assert.equal(active.menus.find((m) => m.id === a.id).remaining, 2);
  assert.equal((await order(a.id, 3)).status, 400);
  assert.equal((await patch("admin/menus/" + a.id, { quota: 2 })).status, 400);
  assert.equal(
    (await patch("admin/preorders/" + po.id, { quota: 2 })).status,
    400,
  );
  // Cancel twice: derived quota must be returned exactly once.
  let orders = (await api("admin/dashboard")).data.orders;
  const created = orders.find(
    (o) => o.code === races.find((r) => r.status === 201).data.code,
  );
  assert.equal(
    (
      await patch("admin/orders/" + created.id + "/status", {
        status: "CANCELLED",
        reason: "Test quota release",
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await patch("admin/orders/" + created.id + "/status", {
        status: "CANCELLED",
        reason: "Test quota release",
      })
    ).status,
    200,
  );
  active = (await api("preorders/active")).data.preorder;
  assert.equal(active.remaining, 10);
  assert.equal(active.menus.find((m) => m.id === a.id).remaining, 5);
  // Batch race across different variants.
  assert.equal(
    (await patch("admin/preorders/" + po.id, { quota: 4 })).status,
    200,
  );
  const cross = await Promise.all([order(a.id, 3), order(b.id, 3)]);
  assert.equal(
    cross.filter((r) => r.status === 201).length,
    1,
    JSON.stringify(cross),
  );
  active = (await api("preorders/active")).data.preorder;
  assert.equal(active.remaining, 1);
  const key = crypto.randomUUID();
  assert.equal((await order(b.id, 1, key)).status, 201);
  assert.equal((await order(b.id, 1, key)).status, 409);
  active = (await api("preorders/active")).data.preorder;
  assert.equal(active.remaining, 0);
  assert(active.menus.every((m) => m.orderable === 0));
  assert.equal((await order(b.id, 1)).status, 400);
  // Existing orders still counted when cap is unset/restored.
  assert.equal(
    (await patch("admin/preorders/" + po.id, { quota: null })).status,
    200,
  );
  active = (await api("preorders/active")).data.preorder;
  assert.equal(active.remaining, null);
  assert.equal(active.used, 4);
  assert.equal(
    (await patch("admin/preorders/" + po.id, { quota: 3 })).status,
    400,
  );
  assert.equal(
    (await patch("admin/preorders/" + po.id, { quota: 4 })).status,
    200,
  );
  console.log(
    "PASS: variant and batch concurrency, exact capacity, cancellation idempotence, cap reductions, existing usage, unlimited quota, duplicate submission.",
  );
})()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (po?.id) await patch("admin/preorders/" + po.id, { active: false });
  });
