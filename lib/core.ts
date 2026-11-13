import { createHash, randomBytes } from "node:crypto";
export const hash = (s: string) => createHash("sha256").update(s).digest("hex");
export const token = () => randomBytes(24).toString("hex");
export function phone(s: string) {
  const p = s.replace(/[\s()+-]/g, "").replace(/^0/, "62");
  if (!/^628\d{8,12}$/.test(p))
    throw Error("Nomor WhatsApp Indonesia tidak valid");
  return p;
}
export const locations = [
  "Veteran Gang 9",
  "Kantin Kampus A UISI",
  "Kantin Kampus B UISI",
  "Gelora Bung Tomo",
];
export const transitions: Record<string, string[]> = {
  PENDING: ["PROCESSING", "CANCELLED"],
  PROCESSING: ["DELIVERING", "READY", "CANCELLED"],
  DELIVERING: ["COMPLETED", "CANCELLED"],
  READY: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};
export function message(
  o: {
    name: string;
    code: string;
    total: number;
    delivery: string;
    location: string;
  },
  event: string,
  url: string,
  reason?: string,
) {
  const intro = `Hai ${o.name}, `;
  if (event === "CREATED")
    return `${intro}pesanan belies.bites ${o.code} berhasil dibuat dan menunggu konfirmasi. Total produk Rp${o.total.toLocaleString("id-ID")}, belum termasuk ongkir. Status: ${url}`;
  if (event === "DELIVERING")
    return `${intro}pesanan ${o.code} sedang diantar. Pastikan nomor WhatsApp aktif, ya. Gunakan tautan status pada pesan konfirmasi awal.`;
  if (event === "READY")
    return `${intro}pesanan ${o.code} siap diambil di ${o.location}. Gunakan tautan status pada pesan konfirmasi awal.`;
  return `${intro}pesanan ${o.code} dibatalkan. Alasan: ${reason}. Jika sudah membayar, hubungi admin untuk tindak lanjut pengembalian dana. Gunakan tautan status pada pesan konfirmasi awal.`;
}
