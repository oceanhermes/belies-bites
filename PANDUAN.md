# Menjalankan belies.bites

Stack: Next.js, React, TypeScript, PostgreSQL/Prisma. Notifikasi WhatsApp menggunakan Fonnte, bukan Cloud API Meta. Source ini tidak bergantung pada hosting Sites.

## Jalankan lokal

Butuh Node.js 22.21+ dan PostgreSQL 17.

```sh
cp .env.example .env
npm ci
npm run db:migrate
npm run db:seed
npm run dev
```

Sebelum migrasi, isi DATABASE_URL di .env. Sebelum seed, isi ADMIN_EMAIL dan ADMIN_PASSWORD (minimal 12 karakter). Jalankan `npm run worker` di terminal kedua. Admin masuk melalui `/admin`. Seed membuat PO **nonaktif** berisi harga contoh; sesuaikan menu dan harga di dashboard sebelum dibuka.

## Aktifkan Fonnte

1. Hubungkan nomor WhatsApp pengirim di dashboard Fonnte.
2. Simpan token di FONNTE_TOKEN pada .env; jangan taruh di kode frontend atau chat.
3. Ubah WHATSAPP_ENABLED=true.
4. Restart web dan worker.
5. Pesan percobaan memakai nomor sendiri. Cek status notifikasi di dashboard admin.

Fonnte mempunyai batas paket/kuota. Periksa penawaran gratis yang berlaku saat mendaftar. Biaya hosting/database tetap bergantung pada layanan yang kamu pilih.

Pemicu notifikasi: pesanan dibuat, mulai diantar, siap diambil, dan dibatalkan. Pesan pembatalan menyertakan alasan; pengembalian uang tetap manual. SENT berarti provider menerima permintaan, bukan bukti pesan sudah diterima/dibaca pembeli. Jika hasil pengiriman UNKNOWN, periksa dashboard Fonnte dahulu sebelum retry agar tidak mengirim dua kali.

## QRIS

Letakkan gambar QRIS asli di `public/qris.png`, isi QRIS_IMAGE_URL=/qris.png, lalu restart web. Tanpa gambar, QRIS disembunyikan. Bukti transfer disimpan privat dan hanya admin login yang dapat melihatnya. Batas file 5 MB, JPG/PNG. Verifikasi pembayaran manual.

## Deploy sendiri dengan Docker

Isi .env termasuk APP_URL=https://domain-kamu.id, ADMIN_EMAIL, ADMIN_PASSWORD dan POSTGRES_PASSWORD (gunakan password acak panjang berbentuk hex). Compose mengatur DATABASE_URL untuk database internal.

```sh
docker compose build
docker compose up -d db
docker compose run --rm web npm run db:migrate
docker compose run --rm web npm run db:seed
docker compose up -d web worker
```

Pasang reverse proxy Caddy/Nginx dengan HTTPS ke 127.0.0.1:3000. Cookie login produksi membutuhkan HTTPS. Atur batas upload request 6 MB dan rate limit pada proxy. Jangan buka port PostgreSQL ke internet. Cadangkan volume database dan uploads. Jalankan migrasi sebelum menyalakan aplikasi pada pembaruan.

## Pemeriksaan

`npm test` untuk unit test dan simulasi provider. `npm run build` untuk build dan pemeriksaan TypeScript. `scripts/integration.cjs` adalah tes terhadap database uji terpisah dengan kredensial contoh; jangan jalankan pada database operasional. Baca README.md untuk rincian endpoint dan batasan.

Ongkir dikonfirmasi admin di luar total produk. Dashboard/ekspor CSV menampilkan maksimal 300 pesanan terbaru. Tautan status berisi token privat; pembeli perlu menyimpannya. Tidak ada webhook delivery receipt Fonnte atau refund otomatis pada versi ini.

## Dashboard admin dan simulasi bahan baku

Sidebar admin menyediakan Ringkasan, Pesanan, Batch & Menu, serta Simulasi Bahan Baku. Simulasi mengikuti file HTML yang diberikan: varian bebas, target pcs, komposisi per pcs, stok bersama, perhitungan kekurangan/sisa, daftar belanja, ekspor CSV, dan cetak PDF dari browser.

Draft kini disimpan ke tabel `SimulationDraft`, bukan localStorage, dan hanya dapat dibaca/diubah admin yang login. Ringkasan draft memuat maksimal 200 terbaru. Simulasi tidak mengubah stok aktual atau pesanan; nama periode bebas diisi dan belum terhubung otomatis ke jumlah pesanan batch. Bahan dengan nama yang sama harus memakai satuan dan stok yang sama.

**Saat update versi ini, jalankan migrasi database sebelum menyalakan web:**

```sh
docker compose build
docker compose run --rm web npm run db:migrate
docker compose up -d web worker
```

Untuk hosting selain Docker, jalankan `npm run db:migrate` dengan DATABASE_URL produksi yang sesuai sebelum menjalankan build baru. Tidak perlu menjalankan seed ulang.
