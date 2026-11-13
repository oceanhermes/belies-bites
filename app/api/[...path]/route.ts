import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { compare } from "bcryptjs";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "../../../lib/db";
import {
  hash,
  token,
  phone,
  locations,
  transitions,
  message,
} from "../../../lib/core";
import { requireAdmin, limit } from "../../../lib/auth";
import { mkdir, writeFile, readFile, unlink } from "node:fs/promises";
import path from "node:path";
export const runtime = "nodejs";
const json = NextResponse.json;
const base = () => {
  const v = process.env.APP_URL;
  if (!v) throw Error("APP_URL belum diatur");
  return v.replace(/\/$/, "");
};
const storage = () =>
  path.resolve(
    /* turbopackIgnore: true */ process.env.UPLOAD_DIR || "./storage",
  );
async function handle(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  try {
    const p = (await params).path.join("/"),
      method = req.method;
    if (!["GET", "HEAD"].includes(method)) {
      if (req.headers.get("origin") !== base())
        return json({ error: "Origin tidak diizinkan" }, { status: 403 });
    }
    if (p === "preorders/active" && method === "GET") {
      const now = new Date();
      const po = await db.preorder.findFirst({
        where: { active: true, startsAt: { lte: now }, closesAt: { gt: now } },
        include: { menus: { where: { available: true } } },
        orderBy: { startsAt: "desc" },
      });
      return json({
        preorder: po,
        qris: process.env.QRIS_IMAGE_URL || null,
        whatsappEnabled: process.env.WHATSAPP_ENABLED === "true",
      });
    }
    if (p === "admin/login" && method === "POST") {
      await limit("login:global", 100, 15);
      const f = z
        .object({
          email: z.email().max(200),
          password: z.string().min(1).max(200),
        })
        .parse(await req.json());
      await limit("login:" + hash(f.email.toLowerCase()), 8, 15);
      const a = await db.admin.findUnique({
        where: { email: f.email.toLowerCase() },
      });
      const ok = await compare(
        f.password,
        a?.passwordHash ||
          "$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6Ttx7bexDlcJTXgQJlVnU6l2q9XfK",
      );
      if (!a || !ok)
        return json({ error: "Email atau password salah" }, { status: 401 });
      const raw = token();
      await db.session.create({
        data: {
          tokenHash: hash(raw),
          adminId: a.id,
          expiresAt: new Date(Date.now() + 8 * 3600000),
        },
      });
      (await cookies()).set("bb_session", raw, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/",
        maxAge: 8 * 3600,
      });
      return json({ ok: true });
    }
    if (p === "orders" && method === "POST") {
      await limit("orders:global", 120, 60);
      const reader = req.body?.getReader();
      if (!reader) throw Error("Form kosong");
      const chunks: Uint8Array[] = [];
      let size = 0;
      while (true) {
        const part = await reader.read();
        if (part.done) break;
        size += part.value.byteLength;
        if (size > 6 * 1024 * 1024) {
          await reader.cancel();
          return json(
            { error: "Ukuran permintaan maksimal 6 MB" },
            { status: 413 },
          );
        }
        chunks.push(part.value);
      }
      const fd = await new Response(Buffer.concat(chunks), {
        headers: { "Content-Type": req.headers.get("content-type") || "" },
      }).formData();
      const input = z
        .object({
          name: z.string().trim().min(2).max(80),
          phone: z.string().max(30),
          payment: z.enum(["CASH", "QRIS"]),
          delivery: z.enum(["PICKUP", "DELIVERY"]),
          location: z.string().trim().min(3).max(400),
          notes: z.string().max(300),
          consent: z.literal(true),
          requestKey: z.uuid(),
          items: z
            .array(
              z.object({
                id: z.string(),
                quantity: z.number().int().min(1).max(50),
              }),
            )
            .min(1)
            .max(20),
        })
        .parse(JSON.parse(String(fd.get("data"))));
      const number = phone(input.phone);
      await limit("orders:" + hash(number), 10, 60);
      if (input.delivery === "PICKUP" && !locations.includes(input.location))
        throw Error("Pilih lokasi pengambilan yang valid");
      if (new Set(input.items.map((i) => i.id)).size !== input.items.length)
        throw Error("Menu duplikat");
      if (
        await db.order.findUnique({ where: { requestKey: input.requestKey } })
      )
        return json(
          {
            error:
              "Pesanan ini sudah diterima. Gunakan tautan status dari WhatsApp.",
          },
          { status: 409 },
        );
      let proofKey: string | undefined;
      if (input.payment === "QRIS") {
        if (!process.env.QRIS_IMAGE_URL) throw Error("QRIS belum tersedia");
        const file = fd.get("proof");
        if (
          !(file instanceof File) ||
          file.size > 5 * 1024 * 1024 ||
          file.size < 8
        )
          throw Error("Bukti transfer wajib JPG/PNG maksimal 5 MB");
        const bytes = Buffer.from(await file.arrayBuffer());
        const png = bytes
            .subarray(0, 8)
            .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
          jpg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
        if (!png && !jpg) throw Error("Bukti harus gambar JPG/PNG");
        proofKey = token() + (png ? ".png" : ".jpg");
        await mkdir(storage(), { recursive: true });
        await writeFile(path.join(storage(), proofKey), bytes, {
          flag: "wx",
          mode: 0o600,
        });
      }
      const tracking = token(),
        code = "BB-" + token().slice(0, 10).toUpperCase(),
        url = base() + "/?track=" + tracking;
      try {
        const order = await db.$transaction(
          async (tx) => {
            const now = new Date();
            const po = await tx.preorder.findFirst({
              where: {
                active: true,
                startsAt: { lte: now },
                closesAt: { gt: now },
              },
              include: { menus: true },
            });
            if (!po) throw Error("Tidak ada PO aktif");
            const items = input.items.map((i) => {
              const m = po.menus.find((m) => m.id === i.id && m.available);
              if (!m) throw Error("Menu tidak tersedia");
              return {
                id: m.id,
                name: m.name,
                price: m.price,
                quantity: i.quantity,
              };
            });
            const total = items.reduce((a, i) => a + i.price * i.quantity, 0);
            const o = await tx.order.create({
              data: {
                code,
                trackingHash: hash(tracking),
                requestKey: input.requestKey,
                preorderId: po.id,
                name: input.name,
                phone: number,
                payment: input.payment,
                delivery: input.delivery,
                location: input.location,
                notes: input.notes,
                consent: true,
                total,
                items,
                proofKey,
              },
            });
            await tx.notification.create({
              data: {
                orderId: o.id,
                event: "CREATED",
                message: message(o, "CREATED", url),
              },
            });
            return o;
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
        return json(
          { code: order.code, tracking, url, total: order.total },
          { status: 201 },
        );
      } catch (e) {
        if (proofKey)
          await unlink(path.join(storage(), proofKey)).catch(() => {});
        throw e;
      }
    }
    if (p === "orders/track" && method === "POST") {
      await limit("track:global", 300, 15);
      const t = z
        .string()
        .regex(/^[a-f0-9]{48}$/)
        .parse((await req.json()).token);
      const o = await db.order.findUnique({
        where: { trackingHash: hash(t) },
        select: {
          code: true,
          status: true,
          delivery: true,
          location: true,
          total: true,
          items: true,
          cancelReason: true,
          createdAt: true,
        },
      });
      return o
        ? json(o)
        : json({ error: "Pesanan tidak ditemukan" }, { status: 404 });
    }
    if (p.startsWith("admin/")) {
      await requireAdmin();
      if (p === "admin/logout" && method === "POST") {
        const c = await cookies(),
          s = c.get("bb_session")?.value;
        if (s) await db.session.deleteMany({ where: { tokenHash: hash(s) } });
        c.delete("bb_session");
        return json({ ok: true });
      }
      if (p === "admin/dashboard" && method === "GET") {
        return json({
          orders: await db.order.findMany({
            include: {
              notifications: {
                select: {
                  id: true,
                  event: true,
                  state: true,
                  lastError: true,
                  attempts: true,
                },
              },
            },
            orderBy: { createdAt: "desc" },
            take: 300,
          }),
          preorders: await db.preorder.findMany({
            include: { menus: true },
            orderBy: { startsAt: "desc" },
          }),
        });
      }
      if (p === "admin/preorders" && method === "POST") {
        const f = z
          .object({
            title: z.string().trim().min(2).max(100),
            startsAt: z.iso.datetime(),
            closesAt: z.iso.datetime(),
          })
          .parse(await req.json());
        if (f.startsAt >= f.closesAt)
          throw Error("Tanggal penutupan harus setelah pembukaan");
        return json(
          await db.preorder.create({ data: { ...f, active: false } }),
        );
      }
      const poMatch = p.match(/^admin\/preorders\/([^/]+)$/);
      if (poMatch && method === "PATCH") {
        const f = z.object({ active: z.boolean() }).parse(await req.json());
        await db.$transaction(
          async (tx) => {
            if (f.active)
              await tx.preorder.updateMany({ data: { active: false } });
            await tx.preorder.update({ where: { id: poMatch[1] }, data: f });
          },
          { isolationLevel: "Serializable" },
        );
        return json({ ok: true });
      }
      if (p === "admin/menus" && method === "POST") {
        const f = z
          .object({
            preorderId: z.string(),
            name: z.string().trim().min(2).max(80),
            description: z.string().max(200),
            price: z.number().int().min(1000).max(10000000),
          })
          .parse(await req.json());
        return json(await db.menu.create({ data: f }));
      }
      const mm = p.match(/^admin\/menus\/([^/]+)$/);
      if (mm && method === "PATCH") {
        const f = z
          .object({
            name: z.string().trim().min(2).max(80),
            description: z.string().max(200),
            price: z.number().int().min(1000).max(10000000),
            available: z.boolean(),
          })
          .partial()
          .parse(await req.json());
        return json(await db.menu.update({ where: { id: mm[1] }, data: f }));
      }
      const sm = p.match(/^admin\/orders\/([^/]+)\/status$/);
      if (sm && method === "PATCH") {
        const f = z
          .object({
            status: z.enum([
              "PROCESSING",
              "DELIVERING",
              "READY",
              "COMPLETED",
              "CANCELLED",
            ]),
            reason: z.string().trim().max(300).optional(),
          })
          .parse(await req.json());
        if (f.status === "CANCELLED" && !f.reason)
          throw Error("Alasan pembatalan wajib diisi");
        await db.$transaction(
          async (tx) => {
            const o = await tx.order.findUniqueOrThrow({
              where: { id: sm[1] },
            });
            if (o.status === f.status) return;
            if (!transitions[o.status]?.includes(f.status))
              throw Error("Perubahan status tidak valid");
            if (
              (f.status === "READY" && o.delivery !== "PICKUP") ||
              (f.status === "DELIVERING" && o.delivery !== "DELIVERY")
            )
              throw Error("Status tidak sesuai metode pengantaran");
            await tx.order.update({
              where: { id: o.id },
              data: {
                status: f.status,
                cancelReason: f.status === "CANCELLED" ? f.reason : null,
              },
            });
            if (["DELIVERING", "READY", "CANCELLED"].includes(f.status))
              await tx.notification.upsert({
                where: { orderId_event: { orderId: o.id, event: f.status } },
                update: {},
                create: {
                  orderId: o.id,
                  event: f.status,
                  message: message(o, f.status, base(), f.reason),
                },
              });
          },
          { isolationLevel: "Serializable" },
        );
        return json({ ok: true });
      }
      const pm = p.match(/^admin\/orders\/([^/]+)\/proof$/);
      if (pm && method === "GET") {
        const o = await db.order.findUniqueOrThrow({ where: { id: pm[1] } });
        if (!o.proofKey)
          return json({ error: "Tidak ada bukti" }, { status: 404 });
        return new NextResponse(
          await readFile(
            /* turbopackIgnore: true */ path.join(
              /* turbopackIgnore: true */ storage(),
              o.proofKey,
            ),
          ),
          {
            headers: {
              "Content-Type": o.proofKey.endsWith(".png")
                ? "image/png"
                : "image/jpeg",
              "Cache-Control": "no-store",
              "X-Content-Type-Options": "nosniff",
            },
          },
        );
      }
      const retry = p.match(/^admin\/notifications\/([^/]+)\/retry$/);
      if (retry && method === "POST") {
        const f = await req.json();
        if (f.confirmed !== true)
          throw Error("Konfirmasi pemeriksaan provider wajib");
        await db.notification.updateMany({
          where: { id: retry[1], state: { in: ["BLOCKED", "UNKNOWN"] } },
          data: { state: "QUEUED", nextAt: new Date(), lastError: null },
        });
        return json({ ok: true });
      }
    }
    return json({ error: "Tidak ditemukan" }, { status: 404 });
  } catch (e) {
    if (e instanceof z.ZodError)
      return json(
        {
          error: "Data tidak valid",
          details: e.issues.map((i) => i.path.join(".") + ": " + i.message),
        },
        { status: 400 },
      );
    const m = e instanceof Error ? e.message : "";
    if (m === "UNAUTHORIZED")
      return json({ error: "Login admin diperlukan" }, { status: 401 });
    if (m === "TOO_MANY")
      return json(
        { error: "Terlalu banyak permintaan. Coba lagi nanti." },
        { status: 429 },
      );
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      return json(
        {
          error:
            e.code === "P2034"
              ? "Data berubah bersamaan. Silakan coba lagi."
              : "Permintaan tidak dapat disimpan",
        },
        { status: 409 },
      );
    }
    if (/DATABASE|connect|prisma|Environment variable/i.test(m)) {
      console.error("Database unavailable");
      return json(
        { error: "Layanan database belum tersedia" },
        { status: 503 },
      );
    }
    return json({ error: m || "Permintaan gagal" }, { status: 400 });
  }
}
export { handle as GET, handle as POST, handle as PATCH };
