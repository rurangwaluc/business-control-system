const { z } = require("zod");

const createCustomerSchema = z.object({
  name: z.string().min(2),
  phone: z.string().min(6),
  notes: z.string().optional()
});

const searchCustomerSchema = z.object({
  q: z.string().min(1)
});

module.exports = { createCustomerSchema, searchCustomerSchema };
