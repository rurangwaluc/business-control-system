const { z } = require("zod");

const createSaleSchema = z.object({
  customerId: z.number().int().positive().optional(),
  customerName: z.string().nullable().optional(), // <-- allow null
  customerPhone: z.string().nullable().optional(), // <-- allow null
  note: z.string().nullable().optional(),
  items: z.array(
    z.object({
      productId: z.number().int().positive(),
      qty: z.number().int().positive()
    })
  ).min(1)
});


// ✅ accept "status" not "mark"
const markSaleSchema = z.object({
  status: z.enum(["PAID", "PENDING"])
});

const cancelSaleSchema = z.object({
  reason: z.string().min(3)
});

module.exports = { createSaleSchema, markSaleSchema, cancelSaleSchema };
