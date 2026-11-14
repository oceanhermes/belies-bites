import { z } from "zod";
export const simulationDraftInput = z
  .object({
    period: z.string().trim().max(120),
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .or(z.literal("")),
    variants: z
      .array(
        z.object({
          id: z.string().max(100),
          name: z.string().trim().min(1).max(100),
          qty: z.number().int().positive().max(1000000),
          ingredients: z
            .array(
              z.object({
                id: z.string().max(100),
                name: z.string().trim().min(1).max(100),
                per: z.number().positive().max(100000000),
                unit: z.enum([
                  "g",
                  "kg",
                  "ml",
                  "L",
                  "keping",
                  "pcs",
                  "butir",
                  "sdm",
                  "sdt",
                ]),
                stock: z.number().nonnegative().max(100000000),
              }),
            )
            .min(1)
            .max(100),
        }),
      )
      .min(1)
      .max(50),
  })
  .superRefine((data, ctx) => {
    const units = new Map<string, string>();
    const stocks = new Map<string, number>();
    for (const v of data.variants)
      for (const i of v.ingredients) {
        const key = i.name.toLocaleLowerCase("id-ID");
        if (units.has(key) && units.get(key) !== i.unit)
          ctx.addIssue({
            code: "custom",
            message: `Satuan ${i.name} harus sama di seluruh varian`,
          });
        if (stocks.has(key) && stocks.get(key) !== i.stock)
          ctx.addIssue({
            code: "custom",
            message: `Stok ${i.name} harus sama di seluruh varian`,
          });
        units.set(key, i.unit);
        stocks.set(key, i.stock);
      }
  });
