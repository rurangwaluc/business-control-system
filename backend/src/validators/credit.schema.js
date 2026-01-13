const { z } = require("zod");

const createCreditSchema = z.object({
  saleId: z.number().int().positive(),
  customerId: z.number().int().positive(),
  note: z.string().optional()
});

const approveCreditSchema = z.object({
  decision: z.enum(["APPROVE", "REJECT"]),
  note: z.string().optional()
});

const settleCreditSchema = z.object({
  creditId: z.number().int().positive(),
  method: z.enum(["CASH", "MOMO"]).optional(),
  note: z.string().optional()
});

module.exports = { createCreditSchema, approveCreditSchema, settleCreditSchema };
