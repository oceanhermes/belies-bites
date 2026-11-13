"use client";
import { useEffect, useState } from "react";
const labels: Record<string, string> = {
  PENDING: "Pending",
  PROCESSING: "Proses",
  DELIVERING: "Diantar",
  READY: "Siap diambil",
  COMPLETED: "Selesai",
  CANCELLED: "Batal",
};
const next: Record<string, string[]> = {
  PENDING: ["PROCESSING", "CANCELLED"],
  PROCESSING: ["DELIVERING", "READY", "CANCELLED"],
  DELIVERING: ["COMPLETED", "CANCELLED"],
  READY: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};
const rp = (n: number) => "Rp" + n.toLocaleString("id-ID");
export default function Admin() {
  const [data, setData] = useState<any>(null),
    [error, setError] = useState(""),
    [query, setQuery] = useState(""),
    [filter, setFilter] = useState(""),
    [busy, setBusy] = useState(false);
  async function api(p: string, method = "GET", body?: unknown) {
    const r = await fetch("/api/" + p, {
      method,
      headers: body ? { "Content-Type": "application/json" } : {},
      body: body ? JSON.stringify(body) : undefined,
    });
    const d = await r.json();
    if (!r.ok) throw Error(d.error);
    return d;
  }
  async function refresh() {
    try {
      setData(await api("admin/dashboard"));
      setError("");
    } catch (e) {
      setData(null);
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    refresh();
  }, []);
  async function action(fn: () => Promise<unknown>) {
    setBusy(true);
    try {
      await fn();
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function exportCSV() {
    const cell = (v: unknown) =>
      '"' +
      String(v ?? "")
        .replace(/"/g, '""')
        .replace(/^[=+@\-\t\r]/, "'") +
      '"';
    const rows = [
      ["Kode", "Nama", "WhatsApp", "Total", "Status", "Metode", "Lokasi"],
      ...data.orders.map((o: any) => [
        o.code,
        o.name,
        o.phone,
        o.total,
        o.status,
        o.delivery,
        o.location,
      ]),
    ];
    const url = URL.createObjectURL(
      new Blob(
        ["\ufeff" + rows.map((r) => r.map(cell).join(",")).join("\r\n")],
        { type: "text/csv" },
      ),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "pesanan-belies.csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <main className="admin">
      <span className="eyebrow">BELIES.BITES ADMIN</span>
      <h1>Ruang pesanan.</h1>
      {error && (
        <p className="alert" role="alert">
          {error}
        </p>
      )}
      {!data ? (
        <form
          className="login card"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            action(() =>
              api("admin/login", "POST", {
                email: f.get("email"),
                password: f.get("password"),
              }),
            );
          }}
        >
          <h2>Masuk admin</h2>
          <label>
            Email
            <input type="email" name="email" autoComplete="username" required />
          </label>
          <label>
            Password
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              required
            />
          </label>
          <button disabled={busy}>Masuk →</button>
        </form>
      ) : (
        <>
          <div className="toolbar">
            <button className="outline" onClick={refresh}>
              Muat ulang
            </button>
            <button className="outline" onClick={exportCSV}>
              Ekspor CSV (maks. 300 terbaru)
            </button>
            <button
              onClick={() =>
                action(async () => {
                  await api("admin/logout", "POST");
                  setData(null);
                })
              }
            >
              Keluar
            </button>
          </div>
          <div className="stats">
            <div className="card">
              Total pesanan<b>{data.orders.length}</b>
            </div>
            <div className="card">
              Belum selesai
              <b>
                {
                  data.orders.filter(
                    (o: any) => !["COMPLETED", "CANCELLED"].includes(o.status),
                  ).length
                }
              </b>
            </div>
            <div className="card">
              Nilai produk aktif
              <b>
                {rp(
                  data.orders
                    .filter((o: any) => o.status !== "CANCELLED")
                    .reduce((a: number, o: any) => a + o.total, 0),
                )}
              </b>
            </div>
          </div>
          <h2>Monitoring pesanan</h2>
          <div className="toolbar">
            <input
              placeholder="Cari nama / nomor pesanan"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <select value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="">Semua status</option>
              {Object.entries(labels).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <div className="tablewrap">
            <table>
              <thead>
                <tr>
                  <th>Pesanan</th>
                  <th>Pelanggan & pengantaran</th>
                  <th>Produk</th>
                  <th>Status</th>
                  <th>Notifikasi WhatsApp</th>
                </tr>
              </thead>
              <tbody>
                {data.orders
                  .filter(
                    (o: any) =>
                      (!filter || o.status === filter) &&
                      (o.name + " " + o.code)
                        .toLowerCase()
                        .includes(query.toLowerCase()),
                  )
                  .map((o: any) => (
                    <tr key={o.id}>
                      <td>
                        <b>{o.code}</b>
                        <p>
                          {new Date(o.createdAt).toLocaleString("id-ID", {
                            timeZone: "Asia/Jakarta",
                          })}{" "}
                          WIB
                        </p>
                        <b>{rp(o.total)}</b>
                        <p>{o.payment}</p>
                        {o.proofKey && (
                          <a
                            href={"/api/admin/orders/" + o.id + "/proof"}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Lihat bukti transfer
                          </a>
                        )}
                      </td>
                      <td>
                        {o.name}
                        <p>{o.phone}</p>
                        <b>
                          {o.delivery === "PICKUP"
                            ? "Ambil di lokasi"
                            : "Diantar"}
                        </b>
                        <p>{o.location}</p>
                        <p>Catatan: {o.notes || "—"}</p>
                      </td>
                      <td>
                        {o.items.map((i: any) => (
                          <p key={i.id}>
                            {i.name} × {i.quantity}
                          </p>
                        ))}
                      </td>
                      <td>
                        <b>{labels[o.status]}</b>
                        {next[o.status]
                          ?.filter(
                            (s) =>
                              !(s === "READY" && o.delivery !== "PICKUP") &&
                              !(
                                s === "DELIVERING" && o.delivery !== "DELIVERY"
                              ),
                          )
                          .map((s) => (
                            <button
                              key={s}
                              className="outline small"
                              disabled={busy}
                              onClick={() => {
                                const reason =
                                  s === "CANCELLED"
                                    ? prompt("Alasan pembatalan (wajib)")
                                    : undefined;
                                if (s === "CANCELLED" && !reason) return;
                                action(() =>
                                  api(
                                    "admin/orders/" + o.id + "/status",
                                    "PATCH",
                                    { status: s, reason },
                                  ),
                                );
                              }}
                            >
                              {labels[s]}
                            </button>
                          ))}
                        {o.cancelReason && <p>{o.cancelReason}</p>}
                      </td>
                      <td>
                        {o.notifications.map((n: any) => (
                          <div key={n.id}>
                            <b>{n.event}</b>
                            <p>
                              {n.state === "SENT"
                                ? "Diterima provider (belum berarti dibaca)"
                                : n.state}
                            </p>
                            <small>{n.lastError}</small>
                            {["UNKNOWN", "BLOCKED"].includes(n.state) && (
                              <button
                                className="outline small"
                                disabled={busy}
                                onClick={() => {
                                  if (
                                    confirm(
                                      "Sudah periksa dashboard Fonnte dan memastikan pesan perlu dikirim ulang? Retry dapat menghasilkan duplikat jika provider sudah menerima pesan.",
                                    )
                                  )
                                    action(() =>
                                      api(
                                        "admin/notifications/" +
                                          n.id +
                                          "/retry",
                                        "POST",
                                        { confirmed: true },
                                      ),
                                    );
                                }}
                              >
                                Coba ulang
                              </button>
                            )}
                          </div>
                        ))}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
            {!data.orders.length && <p className="empty">Belum ada pesanan.</p>}
          </div>
          <h2 style={{ marginTop: 40 }}>Kelola pre-order & menu</h2>
          {data.preorders.map((p: any) => (
            <section className="card manage" key={p.id}>
              <div className="toolbar">
                <h3>{p.title}</h3>
                <span>
                  {p.active ? "Aktif" : "Nonaktif"} ·{" "}
                  {new Date(p.closesAt).toLocaleString("id-ID", {
                    timeZone: "Asia/Jakarta",
                  })}{" "}
                  WIB
                </span>
                <button
                  disabled={busy}
                  onClick={() =>
                    action(() =>
                      api("admin/preorders/" + p.id, "PATCH", {
                        active: !p.active,
                      }),
                    )
                  }
                >
                  {p.active ? "Tutup PO" : "Aktifkan PO"}
                </button>
              </div>
              {p.menus.map((m: any) => (
                <form
                  key={m.id}
                  className="menuform"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    action(() =>
                      api("admin/menus/" + m.id, "PATCH", {
                        name: f.get("name"),
                        description: f.get("description"),
                        price: Number(f.get("price")),
                        available: f.get("available") === "on",
                      }),
                    );
                  }}
                >
                  <input
                    name="name"
                    aria-label="Nama menu"
                    defaultValue={m.name}
                    required
                  />
                  <input
                    name="description"
                    aria-label="Deskripsi"
                    defaultValue={m.description}
                  />
                  <input
                    name="price"
                    type="number"
                    aria-label="Harga"
                    defaultValue={m.price}
                    min={1000}
                    required
                  />
                  <label className="checklabel">
                    <input
                      type="checkbox"
                      name="available"
                      defaultChecked={m.available}
                    />
                    Tersedia
                  </label>
                  <button disabled={busy}>Simpan</button>
                </form>
              ))}
              <details>
                <summary>+ Tambah menu</summary>
                <form
                  className="menuform"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    action(() =>
                      api("admin/menus", "POST", {
                        preorderId: p.id,
                        name: f.get("name"),
                        description: f.get("description"),
                        price: Number(f.get("price")),
                      }),
                    );
                  }}
                >
                  <input name="name" placeholder="Nama menu" required />
                  <input name="description" placeholder="Deskripsi" required />
                  <input
                    name="price"
                    type="number"
                    placeholder="Harga"
                    min={1000}
                    required
                  />
                  <button disabled={busy}>Tambah</button>
                </form>
              </details>
            </section>
          ))}
          <details className="card manage">
            <summary>+ Buat periode PO baru</summary>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                action(() =>
                  api("admin/preorders", "POST", {
                    title: f.get("title"),
                    startsAt: new Date(String(f.get("startsAt"))).toISOString(),
                    closesAt: new Date(String(f.get("closesAt"))).toISOString(),
                  }),
                );
              }}
            >
              <label>
                Nama batch
                <input name="title" required />
              </label>
              <label>
                Mulai (zona waktu perangkat ini)
                <input name="startsAt" type="datetime-local" required />
              </label>
              <label>
                Tutup (zona waktu perangkat ini)
                <input name="closesAt" type="datetime-local" required />
              </label>
              <button disabled={busy}>Buat PO nonaktif</button>
            </form>
          </details>
        </>
      )}
    </main>
  );
}
