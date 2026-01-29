const { z } = require("zod");

const createCashReconcileSchema = z.object({
  cashSessionId: z.number().int().positive(),
  expectedCash: z.number().int().min(0),
  countedCash: z.number().int().min(0),
  note: z.string().max(200).optional(),
});

module.exports = { createCashReconcileSchema };
