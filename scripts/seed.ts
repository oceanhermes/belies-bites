import { hash } from "bcryptjs";
import { db } from "../lib/db";
async function main() {
  const email = process.env.ADMIN_EMAIL?.toLowerCase(),
    password = process.env.ADMIN_PASSWORD;
  if (!email || !password || password.length < 12)
    throw Error("Isi ADMIN_EMAIL dan ADMIN_PASSWORD minimal 12 karakter");
  await db.admin.upsert({
    where: { email },
    update: { passwordHash: await hash(password, 12) },
    create: { email, passwordHash: await hash(password, 12) },
  });
  if (!(await db.preorder.count()))
    await db.preorder.create({
      data: {
        title: "Batch pertama belies.bites",
        active: false,
        startsAt: new Date(),
        closesAt: new Date(Date.now() + 7 * 86400000),
        menus: {
          create: [
            {
              name: "Gabin Original",
              description:
                "Renyah di luar, lembut vla susu di dalam. Isi 4 pcs.",
              price: 15000,
            },
            {
              name: "Gabin Cokelat",
              description: "Vla cokelat lembut. Isi 4 pcs.",
              price: 18000,
            },
            {
              name: "Gabin Keju",
              description: "Vla creamy dengan gurihnya keju. Isi 4 pcs.",
              price: 18000,
            },
          ],
        },
      },
    });
  console.log(
    "Admin siap. PO contoh nonaktif; sesuaikan menu dan harga sebelum dibuka.",
  );
}
main().finally(() => db.$disconnect());
