"use client";
import { useEffect, useState } from "react";
type Menu = { id: string; name: string; description: string; price: number };
type PO = { id: string; title: string; closesAt: string; menus: Menu[] };
const rp = (n: number) => "Rp" + n.toLocaleString("id-ID");
const labels: Record<string, string> = {
  PENDING: "Menunggu konfirmasi",
  PROCESSING: "Sedang disiapkan",
  DELIVERING: "Sedang diantar",
  READY: "Siap diambil",
  COMPLETED: "Selesai",
  CANCELLED: "Dibatalkan",
};
export default function Home() {
  const [po, setPo] = useState<PO | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [qris, setQris] = useState(""),
    [cart, setCart] = useState<Record<string, number>>({}),
    [modal, setModal] = useState(""),
    [busy, setBusy] = useState(false),
    [payment, setPayment] = useState("CASH"),
    [delivery, setDelivery] = useState("PICKUP"),
    [result, setResult] = useState<any>(null),
    [order, setOrder] = useState<any>(null),
    [key, setKey] = useState("");
  useEffect(() => {
    fetch("/api/preorders/active")
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw Error(d.error);
        setPo(d.preorder);
        setQris(d.qris || "");
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
    const url = new URL(location.href);
    if (url.searchParams.has("cek")) setModal("track");
    const t = url.searchParams.get("track");
    if (t) {
      loadOrder(t);
      history.replaceState(null, "", "/");
    }
  }, []);
  const items = po?.menus.filter((m) => cart[m.id]) || [],
    total = items.reduce((a, m) => a + m.price * cart[m.id], 0);
  function add(id: string, n: number) {
    setCart((c) => ({
      ...c,
      [id]: Math.max(0, Math.min(50, (c[id] || 0) + n)),
    }));
  }
  async function loadOrder(t: string) {
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/orders/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: t }),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      setOrder(d);
      setModal("status");
    } catch (e) {
      setError((e as Error).message);
      setModal("track");
    } finally {
      setBusy(false);
    }
  }
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const f = new FormData(e.currentTarget),
      payload = {
        name: f.get("name"),
        phone: f.get("phone"),
        payment,
        delivery,
        location: f.get(delivery === "PICKUP" ? "location" : "address"),
        notes: f.get("notes"),
        consent: f.get("consent") === "on",
        requestKey: key,
        items: items.map((m) => ({ id: m.id, quantity: cart[m.id] })),
      };
    const body = new FormData();
    body.set("data", JSON.stringify(payload));
    if (f.get("proof")) body.set("proof", f.get("proof")!);
    try {
      const r = await fetch("/api/orders", { method: "POST", body });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      setResult(d);
      setCart({});
      setModal("success");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <main>
        <section className="hero">
          <div>
            <span className="badge">● &nbsp; HOMEMADE, WITH LOVE</span>
            <h1>
              Sedikit renyah.
              <br />
              Banyak <em>bahagianya.</em>
            </h1>
            <p>
              Gabin dengan isian lembut yang bikin kangen. Dibuat fresh khusus
              untukmu, satu pre-order setiap waktu.
            </p>
            <small>
              ✧ Freshly made &nbsp; · &nbsp; Bahan pilihan &nbsp; · &nbsp; Tanpa
              pengawet
            </small>
          </div>
          <div className="heroart">
            <div className="plate">
              <i className="gabin" />
              <i className="gabin" />
            </div>
            <span>A little bite of happiness ♡</span>
          </div>
        </section>
        {error && !modal && (
          <p role="alert" className="alert">
            {error}
          </p>
        )}
        <section className="batch">
          <div>
            <span className="eyebrow">
              {loading
                ? "MEMUAT…"
                : po
                  ? "● PRE-ORDER DIBUKA"
                  : "PRE-ORDER BELUM AKTIF"}
            </span>
            <h3>{po?.title || "Nantikan batch berikutnya"}</h3>
            <p>
              {po
                ? "Pesan sebelum " +
                  new Date(po.closesAt).toLocaleString("id-ID", {
                    timeZone: "Asia/Jakarta",
                  }) +
                  " WIB."
                : "Menu dapat dipesan ketika admin membuka pre-order."}
            </p>
          </div>
          <span>Fresh dibuat sesuai pesanan ♡</span>
        </section>
        <div className="sectionhead" id="menu">
          <div>
            <h2>Pilih gigitan favoritmu</h2>
            <p>Satu box saja? Rasanya sayang.</p>
          </div>
          <span className="badge">Menu pre-order</span>
        </div>
        <div className="layout">
          <section className="products">
            {po?.menus.map((m, i) => (
              <article className="card" key={m.id}>
                <div className={"food tone" + (i % 4)}>
                  <i className="gabin" />
                  <span className="foodtag">Homemade gabin</span>
                </div>
                <div className="cardbody">
                  <h3>{m.name}</h3>
                  <p>{m.description}</p>
                  <div className="price">
                    <b>
                      {rp(m.price)} <small>/ box</small>
                    </b>
                    <button className="outline" onClick={() => add(m.id, 1)}>
                      + Tambah
                    </button>
                  </div>
                </div>
              </article>
            ))}
            {!loading && po?.menus.length === 0 && (
              <p>Menu sedang disiapkan admin.</p>
            )}
          </section>
          <aside className="cart">
            <h3>
              Keranjangmu{" "}
              <small>
                {Object.values(cart).reduce((a, b) => a + b, 0)} box
              </small>
            </h3>
            {!items.length ? (
              <div className="empty">
                ♧
                <p>
                  Masih kosong, nih.
                  <br />
                  Yuk, pilih gabin favoritmu.
                </p>
              </div>
            ) : (
              items.map((m) => (
                <div className="cartrow" key={m.id}>
                  <b>{m.name}</b>
                  <span>{rp(m.price * cart[m.id])}</span>
                  <div className="qty">
                    <button
                      onClick={() => add(m.id, -1)}
                      aria-label={"Kurangi " + m.name}
                    >
                      −
                    </button>
                    {cart[m.id]}
                    <button
                      onClick={() => add(m.id, 1)}
                      aria-label={"Tambah " + m.name}
                    >
                      +
                    </button>
                  </div>
                </div>
              ))
            )}
            <div className="total">
              <span>Total produk</span>
              <b>{rp(total)}</b>
            </div>
            <button
              className="full"
              disabled={!items.length}
              onClick={() => {
                setError("");
                setKey(crypto.randomUUID());
                setModal("checkout");
              }}
            >
              Lanjut pemesanan →
            </button>
            <p className="note">Ongkir dikonfirmasi admin secara terpisah.</p>
          </aside>
        </div>
        <div className="benefits">
          <p>
            ✧ <b>Dibuat fresh</b>
            <br />
            Khusus untuk pesananmu.
          </p>
          <p>
            ♡ <b>Bahan pilihan</b>
            <br />
            Rasa rumahan yang dirindukan.
          </p>
          <p>
            ▣ <b>Ambil atau antar</b>
            <br />
            Pilih yang nyaman untukmu.
          </p>
        </div>
      </main>
      {modal && (
        <div className="overlay">
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label="Pemesanan"
          >
            <button
              className="close"
              onClick={() => {
                if (!busy) {
                  setModal("");
                  setError("");
                }
              }}
              aria-label="Tutup"
            >
              ×
            </button>
            {error && (
              <p role="alert" className="alert">
                {error}
              </p>
            )}
            {modal === "checkout" && (
              <>
                <h2>Form Pemesanan</h2>
                <p>Lengkapi data untuk memesan gabin favoritmu.</p>
                <form onSubmit={submit}>
                  <label>
                    Nama lengkap *
                    <input name="name" required minLength={2} maxLength={80} />
                  </label>
                  <label>
                    Nomor WhatsApp *
                    <input
                      name="phone"
                      type="tel"
                      required
                      placeholder="081234567890"
                      maxLength={30}
                    />
                  </label>
                  <label>
                    Metode pembayaran *
                    <select
                      value={payment}
                      onChange={(e) => setPayment(e.target.value)}
                    >
                      <option value="CASH">Tunai saat menerima pesanan</option>
                      {qris && <option value="QRIS">QRIS</option>}
                    </select>
                  </label>
                  {payment === "QRIS" && (
                    <>
                      <img
                        className="qris"
                        src={qris}
                        alt="QRIS belies.bites"
                      />
                      <label>
                        Bukti transfer JPG/PNG, maksimal 5 MB *
                        <input
                          name="proof"
                          type="file"
                          accept="image/jpeg,image/png"
                          required
                        />
                      </label>
                    </>
                  )}
                  <label>
                    Metode pengantaran *
                    <select
                      value={delivery}
                      onChange={(e) => setDelivery(e.target.value)}
                    >
                      <option value="PICKUP">Ambil di lokasi</option>
                      <option value="DELIVERY">
                        Diantar (ongkir dikonfirmasi admin)
                      </option>
                    </select>
                  </label>
                  {delivery === "PICKUP" ? (
                    <label>
                      Lokasi pengambilan *
                      <select name="location" required>
                        <option value="">Pilih lokasi</option>
                        {[
                          "Veteran Gang 9",
                          "Kantin Kampus A UISI",
                          "Kantin Kampus B UISI",
                          "Gelora Bung Tomo",
                        ].map((l) => (
                          <option key={l}>{l}</option>
                        ))}
                      </select>
                    </label>
                  ) : (
                    <label>
                      Alamat lengkap *
                      <textarea
                        name="address"
                        required
                        minLength={3}
                        maxLength={400}
                      />
                    </label>
                  )}
                  <label>
                    Catatan
                    <textarea name="notes" maxLength={300} />
                  </label>
                  <label className="checklabel">
                    <input type="checkbox" name="consent" required />
                    Saya menyetujui penggunaan nomor WhatsApp untuk notifikasi
                    pesanan dan koordinasi pengantaran.
                  </label>
                  <div className="total">
                    <span>Total produk</span>
                    <b>{rp(total)}</b>
                  </div>
                  <button className="full" disabled={busy}>
                    {busy ? "Menyimpan…" : "Buat pesanan →"}
                  </button>
                </form>
              </>
            )}
            {modal === "success" && (
              <div className="success">
                <div className="successicon">✓</div>
                <h2>Pesanan berhasil dibuat!</h2>
                <p>
                  Pesanan diterima dan menunggu konfirmasi. Notifikasi WhatsApp
                  akan dikirim melalui antrean.
                </p>
                <h3 className="code">{result.code}</h3>
                <p>
                  Simpan tautan ini untuk mengecek status. Tautan berisi akses
                  privat ke pesananmu.
                </p>
                <button
                  className="outline full"
                  onClick={() =>
                    navigator.clipboard
                      .writeText(result.url)
                      .then(() => alert("Tautan disalin"))
                      .catch(() => prompt("Salin tautan:", result.url))
                  }
                >
                  Salin tautan status
                </button>
                <a className="button full" href={result.url}>
                  Lihat status pesanan
                </a>
              </div>
            )}
            {modal === "track" && (
              <>
                <h2>Cek status pesanan</h2>
                <p>
                  Tempel tautan status yang diterima saat checkout atau melalui
                  WhatsApp.
                </p>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const val = String(
                      new FormData(e.currentTarget).get("tracking"),
                    ).trim();
                    try {
                      loadOrder(new URL(val).searchParams.get("track") || val);
                    } catch {
                      loadOrder(val);
                    }
                  }}
                >
                  <label>
                    Tautan atau token pelacakan
                    <input name="tracking" required />
                  </label>
                  <button disabled={busy} className="full">
                    {busy ? "Mencari…" : "Lihat status"}
                  </button>
                </form>
              </>
            )}
            {modal === "status" && order && (
              <>
                <span className="eyebrow">{order.code}</span>
                <h2>Status Pesanan</h2>
                <div className="code">{labels[order.status]}</div>
                {order.cancelReason && (
                  <p className="alert">Alasan: {order.cancelReason}</p>
                )}
                <p>
                  {order.delivery === "PICKUP"
                    ? "Lokasi pengambilan"
                    : "Alamat pengantaran"}
                  : {order.location}
                </p>
                {order.items.map((m: any) => (
                  <p key={m.id}>
                    {m.name} × {m.quantity}
                    <b style={{ float: "right" }}>{rp(m.price * m.quantity)}</b>
                  </p>
                ))}
                <div className="total">
                  <span>Total produk</span>
                  <b>{rp(order.total)}</b>
                </div>
                <p className="note">
                  Ongkir dan pengembalian dana dikoordinasikan admin.
                </p>
              </>
            )}
          </section>
        </div>
      )}
    </>
  );
}
