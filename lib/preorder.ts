import { z } from "zod";
import { quotaInput } from "./quota";
export const preorderInput = z
  .object({
    quota: quotaInput.optional(),
    title: z
      .string()
      .trim()
      .min(2, "Nama batch minimal 2 karakter")
      .max(100, "Nama batch maksimal 100 karakter"),
    startsAt: z.iso.datetime({ message: "Waktu mulai tidak valid" }),
    closesAt: z.iso.datetime({ message: "Waktu tutup tidak valid" }),
  })
  .refine(
    (v) => new Date(v.closesAt).getTime() > new Date(v.startsAt).getTime(),
    { message: "Waktu tutup harus setelah waktu mulai", path: ["closesAt"] },
  );
export function wibToISO(date: string, time: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time))
    throw Error("Lengkapi tanggal dan jam mulai serta tutup.");
  const d = new Date(`${date}T${time}:00+07:00`);
  if (
    !Number.isFinite(d.getTime()) ||
    new Intl.DateTimeFormat("sv-SE", {
      timeZone: "Asia/Jakarta",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(d) !== date
  )
    throw Error("Tanggal tidak valid.");
  return d.toISOString();
}
export function wibDate(date = new Date()) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}
