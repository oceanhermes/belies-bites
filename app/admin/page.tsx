"use client";
import { useEffect, useState } from "react";
import { preorderInput, wibToISO, wibDate } from "../../lib/preorder";
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
  const [view, setView] = useState("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [batchError, setBatchError] = useState("");
  const [batchSuccess, setBatchSuccess] = useState("");
  const [creatingBatch, setCreatingBatch] = useState(false);
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
    if (!r.ok)
      throw Error(
        d.details?.length
          ? d.details.join("; ")
          : d.error || "Permintaan gagal",
      );
    return d;
  }
  async function refresh() {
    try {
      setData(await api("admin/dashboard"));
      setError("");
    } catch (e) {
      setData(null);
      setError(
        (e as Error).message === "Login admin diperlukan"
          ? ""
          : (e as Error).message,
      );
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
    <main
      className={
        "admin admin-workspace " + (data ? "authenticated" : "login-screen")
      }
    >
      {data && (
        <aside className={"admin-sidebar " + (sidebarOpen ? "is-open" : "")}>
          <a className="admin-logo" href="/admin">
            belies<span>.</span>bites<small>ADMIN WORKSPACE</small>
          </a>
          <p className="sidebar-caption">KELOLA BISNIS</p>
          <nav aria-label="Navigasi admin">
            {[
              ["overview", "◫", "Ringkasan"],
              ["orders", "▤", "Pesanan"],
              ["batches", "▦", "Batch & Menu"],
              ["simulation", "◉", "Simulasi Bahan Baku"],
            ].map(([id, icon, title]) => (
              <button
                key={id}
                className={view === id ? "selected" : ""}
                aria-current={view === id ? "page" : undefined}
                onClick={() => {
                  setView(id);
                  setSidebarOpen(false);
                }}
              >
                <span aria-hidden="true">{icon}</span>
                {title}
                {id === "orders" && (
                  <b>
                    {
                      data.orders.filter((o: any) => o.status === "PENDING")
                        .length
                    }
                  </b>
                )}
              </button>
            ))}
          </nav>
          <div className="sidebar-bottom">
            <div className="sidebar-tip">
              <strong>Rencana rapi, produksi happy.</strong>
              <p>Hitung kebutuhan bahan sebelum membuka batch berikutnya.</p>
            </div>
            <a href="/" target="_blank" rel="noreferrer">
              Lihat katalog ↗
            </a>
            <button
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await api("admin/logout", "POST");
                  setData(null);
                  setError("");
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Keluar akun
            </button>
          </div>
        </aside>
      )}
      <div className="admin-body">
        {data ? (
          <header className="admin-topbar">
            <div>
              <button
                className="sidebar-toggle"
                aria-label="Buka navigasi admin"
                aria-expanded={sidebarOpen}
                onClick={() => setSidebarOpen(!sidebarOpen)}
              >
                ☰
              </button>
              <span>
                Workspace /{" "}
                <b>
                  {
                    {
                      overview: "Ringkasan",
                      orders: "Pesanan",
                      batches: "Batch & Menu",
                      simulation: "Simulasi Bahan Baku",
                    }[view]
                  }
                </b>
              </span>
            </div>
            <span className="admin-account">● Admin</span>
          </header>
        ) : (
          <a className="admin-logo" href="/">
            belies.bites
          </a>
        )}
        <div className="admin-content">
          <div className="admin-heading">
            <div>
              <span className="eyebrow">BELIES.BITES ADMIN</span>
              <h1>
                {!data
                  ? "Selamat datang."
                  : {
                      overview: "Bisnis manis, terpantau.",
                      orders: "Semua pesananmu.",
                      batches: "Siapkan batch berikutnya.",
                      simulation: "Rencanakan bahan baku.",
                    }[view]}
              </h1>
              <p>
                {!data
                  ? "Masuk untuk mengelola pre-order belies.bites."
                  : {
                      overview:
                        "Pantau pesanan dan aktivitas pre-order dalam satu tempat.",
                      orders:
                        "Periksa pesanan, pembayaran, pengantaran, dan notifikasi WhatsApp.",
                      batches:
                        "Kelola jadwal pre-order, varian, harga, serta ketersediaan menu.",
                      simulation:
                        "Hitung kebutuhan produksi, stok bersama, dan daftar belanja.",
                    }[view]}
              </p>
            </div>
            {data && (
              <button className="outline" disabled={busy} onClick={refresh}>
                ↻ Muat ulang
              </button>
            )}
          </div>
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
                <input
                  type="email"
                  name="email"
                  autoComplete="username"
                  required
                />
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
              <section hidden={view !== "overview"}>
                <div className="stats">
                  <div className="card">
                    Total pesanan<b>{data.orders.length}</b>
                  </div>
                  <div className="card">
                    Belum selesai
                    <b>
                      {
                        data.orders.filter(
                          (o: any) =>
                            !["COMPLETED", "CANCELLED"].includes(o.status),
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
                <div className="overview-grid">
                  <section className="dashboard-panel">
                    <div className="panel-title">
                      <h2>Aktivitas pesanan</h2>
                      <button
                        className="outline"
                        onClick={() => setView("orders")}
                      >
                        Lihat semua →
                      </button>
                    </div>
                    <p className="dashboard-muted">
                      Ringkasan dari {data.orders.length} pesanan terbaru, bukan
                      laporan pendapatan bersih.
                    </p>
                    <div className="status-bars">
                      {Object.entries(labels).map(([id, label]) => {
                        const n = data.orders.filter(
                          (o: any) => o.status === id,
                        ).length;
                        return (
                          <div key={id}>
                            <span>{label}</span>
                            <div>
                              <i
                                style={{
                                  width:
                                    (data.orders.length
                                      ? (n / data.orders.length) * 100
                                      : 0) + "%",
                                }}
                              />
                            </div>
                            <b>{n}</b>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                  <section className="dashboard-panel active-batches">
                    <span className="eyebrow">PRE-ORDER</span>
                    <h2>Batch terpilih</h2>
                    {data.preorders.filter((p: any) => p.active).length ? (
                      data.preorders
                        .filter((p: any) => p.active)
                        .map((p: any) => (
                          <div key={p.id}>
                            <h3>{p.title}</h3>
                            <p>
                              {new Date(p.startsAt).toLocaleString("id-ID", {
                                timeZone: "Asia/Jakarta",
                              })}{" "}
                              –{" "}
                              {new Date(p.closesAt).toLocaleString("id-ID", {
                                timeZone: "Asia/Jakarta",
                              })}{" "}
                              WIB
                            </p>
                            <p>
                              {p.menus.length} menu · Ketersediaan mengikuti
                              jadwal batch.
                            </p>
                          </div>
                        ))
                    ) : (
                      <p>Belum ada batch yang diaktifkan.</p>
                    )}
                    <button onClick={() => setView("batches")}>
                      Kelola batch →
                    </button>
                  </section>
                </div>
                <section className="dashboard-panel">
                  <div className="panel-title">
                    <h2>Produksi berikutnya?</h2>
                    <span className="pill">PLANNER</span>
                  </div>
                  <p>
                    Susun varian, hitung kebutuhan gabungan bahan, dan simpan
                    rencana produksi agar bisa dilanjutkan di perangkat lain.
                  </p>
                  <button
                    className="outline"
                    onClick={() => setView("simulation")}
                  >
                    Buka simulasi bahan baku →
                  </button>
                </section>
              </section>
              <section hidden={view !== "orders"}>
                <div className="panel-title">
                  <h2>Monitoring pesanan</h2>
                  <button className="outline" onClick={exportCSV}>
                    ↓ Ekspor CSV (300 terbaru)
                  </button>
                </div>

                <div className="toolbar">
                  <input
                    placeholder="Cari nama / nomor pesanan"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                  <select
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                  >
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
                                    !(
                                      s === "READY" && o.delivery !== "PICKUP"
                                    ) &&
                                    !(
                                      s === "DELIVERING" &&
                                      o.delivery !== "DELIVERY"
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
                  {!data.orders.length && (
                    <p className="empty">Belum ada pesanan.</p>
                  )}
                </div>
              </section>
              <section hidden={view !== "batches"}>
                <h2>Kelola pre-order & menu</h2>

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
                        <input
                          name="description"
                          placeholder="Deskripsi"
                          required
                        />
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
                <details className="card manage" id="new-batch">
                  <summary>+ Buat periode PO baru</summary>
                  <p>
                    Isi nama dan jadwal dalam WIB. Batch baru disimpan sebagai
                    nonaktif; tambahkan menu lalu aktifkan ketika sudah siap.
                  </p>
                  {batchError && (
                    <p className="alert" role="alert">
                      {batchError}
                    </p>
                  )}
                  {batchSuccess && (
                    <p className="batch-success" role="status">
                      {batchSuccess}
                    </p>
                  )}
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      if (creatingBatch) return;
                      const form = e.currentTarget;
                      const f = new FormData(form);
                      setBatchError("");
                      setBatchSuccess("");
                      setCreatingBatch(true);
                      try {
                        const parsed = preorderInput.safeParse({
                          title: f.get("title"),
                          startsAt: wibToISO(
                            String(f.get("startDate")),
                            String(f.get("startTime")),
                          ),
                          closesAt: wibToISO(
                            String(f.get("closeDate")),
                            String(f.get("closeTime")),
                          ),
                        });
                        if (!parsed.success)
                          throw Error(
                            parsed.error.issues
                              .map((i) => i.message)
                              .join(". "),
                          );
                        const created = await api(
                          "admin/preorders",
                          "POST",
                          parsed.data,
                        );
                        const updated = await api("admin/dashboard");
                        setData(updated);
                        setBatchSuccess(
                          `Batch "${created.title}" berhasil dibuat. Tambahkan menu di kartu batch, kemudian klik Aktifkan PO.`,
                        );
                        form.reset();
                      } catch (e) {
                        setBatchError((e as Error).message);
                      } finally {
                        setCreatingBatch(false);
                      }
                    }}
                  >
                    <label>
                      Nama batch
                      <input
                        name="title"
                        placeholder="Contoh: Batch 02 — Gabin akhir pekan"
                        minLength={2}
                        maxLength={100}
                        required
                      />
                    </label>
                    <fieldset className="batch-schedule">
                      <legend>Mulai (WIB)</legend>
                      <label>
                        Tanggal mulai
                        <input
                          name="startDate"
                          type="date"
                          defaultValue={wibDate()}
                          required
                        />
                      </label>
                      <label>
                        Jam mulai
                        <input
                          name="startTime"
                          type="time"
                          defaultValue="08:00"
                          required
                        />
                      </label>
                    </fieldset>
                    <fieldset className="batch-schedule">
                      <legend>Tutup (WIB)</legend>
                      <label>
                        Tanggal tutup
                        <input
                          name="closeDate"
                          type="date"
                          defaultValue={wibDate(
                            new Date(Date.now() + 86400000),
                          )}
                          required
                        />
                      </label>
                      <label>
                        Jam tutup
                        <input
                          name="closeTime"
                          type="time"
                          defaultValue="20:00"
                          required
                        />
                      </label>
                    </fieldset>
                    <button disabled={creatingBatch || busy}>
                      {creatingBatch ? "Menyimpan batch…" : "Buat batch"}
                    </button>
                  </form>
                </details>
              </section>
              {view === "simulation" && (
                <section className="simulation-workspace">
                  <div className="simulation-banner">
                    <span>PRODUCTION PLANNER</span>
                    <h2>Sedikit hitung, banyak tenang.</h2>
                    <p>
                      Perencanaan bahan berdasarkan resep yang kamu input. Tidak
                      mengurangi stok aktual secara otomatis.
                    </p>
                  </div>
                  <iframe
                    className="simulation-frame"
                    title="Simulasi kebutuhan bahan baku"
                    src="/api/admin/simulator"
                  />
                </section>
              )}
            </>
          )}
        </div>
      </div>
    </main>
  );
}
