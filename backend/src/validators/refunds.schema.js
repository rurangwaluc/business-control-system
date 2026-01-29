const { z } = require("zod");

const createRefundSchema = z.object({
  saleId: z.number().int().positive(),
  reason: z.string().min(3).max(300).optional(),
});

module.exports = { createRefundSchema };
