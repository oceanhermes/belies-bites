import { db } from "../lib/db";
import { sendWhatsApp } from "../lib/fonnte";
let stop = false;
process.on("SIGTERM", () => {
  stop = true;
});
process.on("SIGINT", () => {
  stop = true;
});
async function tick() {
  await db.notification.updateMany({
    where: {
      state: "SENDING",
      lockedAt: { lt: new Date(Date.now() - 120000) },
    },
    data: {
      state: "UNKNOWN",
      lastError: "Worker terhenti saat mengirim; cek provider sebelum retry",
    },
  });
  const jobs = await db.notification.findMany({
    where: { state: { in: ["QUEUED", "RETRY"] }, nextAt: { lte: new Date() } },
    include: { order: true },
    take: 10,
    orderBy: { createdAt: "asc" },
  });
  for (const j of jobs) {
    const lock = await db.notification.updateMany({
      where: { id: j.id, state: j.state },
      data: {
        state: "SENDING",
        lockedAt: new Date(),
        attempts: { increment: 1 },
      },
    });
    if (!lock.count) continue;
    const result = await sendWhatsApp(j.order.phone, j.message);
    await db.notification.update({
      where: { id: j.id },
      data: {
        state:
          result.state === "RETRY" && j.attempts >= 4
            ? "BLOCKED"
            : result.state,
        providerId: result.providerId,
        lastError: result.error ?? null,
        lockedAt: null,
        nextAt: new Date(
          Date.now() + Math.min(3600000, 30000 * 2 ** j.attempts),
        ),
      },
    });
  }
}
async function main() {
  while (!stop) {
    try {
      await tick();
      await db.rateLimit.deleteMany({
        where: { expiresAt: { lt: new Date(Date.now() - 3600000) } },
      });
    } catch {
      console.error("Notification worker database error; retrying");
    }
    await new Promise((r) => setTimeout(r, 3000));
  }
  await db.$disconnect();
}
main();
