import { z } from "zod";
import type { Prisma } from "@prisma/client";
export const quotaInput = z.number().int().min(0).max(1000000).nullable();
export const remainingQuota = (quota: number | null, used: number) =>
  quota === null ? null : Math.max(0, quota - used);
export function summarizeUsage(orders: { items: Prisma.JsonValue }[]) {
  let total = 0;
  const menus: Record<string, number> = {};
  for (const o of orders) {
    if (!Array.isArray(o.items)) continue;
    for (const value of o.items) {
      const i = value as { id?: string; quantity?: number } | null;
      if (
        !i ||
        typeof i.id !== "string" ||
        !Number.isInteger(i.quantity) ||
        i.quantity! <= 0
      )
        continue;
      total += i.quantity!;
      menus[i.id] = (menus[i.id] || 0) + i.quantity!;
    }
  }
  return { total, menus };
}
export async function usageFor(
  tx: Pick<Prisma.TransactionClient, "order">,
  preorderId: string,
) {
  return summarizeUsage(
    await tx.order.findMany({
      where: { preorderId, status: { not: "CANCELLED" } },
      select: { items: true },
    }),
  );
}
export async function withQuota<
  T extends {
    id: string;
    quota: number | null;
    menus: { id: string; quota: number | null }[];
  },
>(tx: Pick<Prisma.TransactionClient, "order">, po: T) {
  const used = await usageFor(tx, po.id);
  const remaining = remainingQuota(po.quota, used.total);
  return {
    ...po,
    used: used.total,
    remaining,
    menus: po.menus.map((m) => {
      const own = remainingQuota(m.quota, used.menus[m.id] || 0);
      return {
        ...m,
        used: used.menus[m.id] || 0,
        remaining: own,
        orderable:
          remaining === null
            ? own
            : own === null
              ? remaining
              : Math.min(remaining, own),
      };
    }),
  };
}
export function assertCapacity(
  quota: number | null,
  used: number,
  requested: number,
  label: string,
) {
  if (quota !== null && used + requested > quota)
    throw Error(
      `Kuota ${label} tidak mencukupi. Sisa ${remainingQuota(quota, used)} box.`,
    );
}
