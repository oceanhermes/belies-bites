import { cookies } from "next/headers";
import { db } from "./db";
import { hash } from "./core";
export async function requireAdmin() {
  const raw = (await cookies()).get("bb_session")?.value;
  if (!raw) throw Error("UNAUTHORIZED");
  const s = await db.session.findUnique({ where: { tokenHash: hash(raw) } });
  if (!s || s.expiresAt < new Date()) throw Error("UNAUTHORIZED");
  return s.adminId;
}
export async function limit(key: string, max: number, minutes: number) {
  const now = new Date(),
    bucket = Math.floor(now.getTime() / (minutes * 60000));
  const row = await db.rateLimit.upsert({
    where: { key: `${key}:${bucket}` },
    create: {
      key: `${key}:${bucket}`,
      expiresAt: new Date(now.getTime() + minutes * 60000),
    },
    update: { count: { increment: 1 } },
  });
  if (row.count > max) throw Error("TOO_MANY");
}
