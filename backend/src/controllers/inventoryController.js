const { createProductSchema, adjustInventorySchema } = require("../validators/inventory.schema");
const inventoryService = require("../services/inventoryService");

async function createProduct(request, reply) {
  const parsed = createProductSchema.safeParse(request.body);
  if (!parsed.success) return reply.status(400).send({ error: "Invalid payload", details: parsed.error.flatten() });

  const created = await inventoryService.createProduct({
    locationId: request.user.locationId,
    userId: request.user.id,
    data: parsed.data
  });

  return reply.send({ ok: true, product: created });
}

async function listProducts(request, reply) {
  const rows = await inventoryService.listProducts({ locationId: request.user.locationId });
  return reply.send({ ok: true, products: rows });
}

async function listInventory(request, reply) {
  const result = await inventoryService.getInventoryBalances({ locationId: request.user.locationId });
  // db.execute returns { rows } in node-postgres
  return reply.send({ ok: true, inventory: result.rows || result });
}

async function adjustInventory(request, reply) {
  const parsed = adjustInventorySchema.safeParse(request.body);
  if (!parsed.success) return reply.status(400).send({ error: "Invalid payload", details: parsed.error.flatten() });

  try {
    const out = await inventoryService.adjustInventory({
      locationId: request.user.locationId,
      userId: request.user.id,
      productId: parsed.data.productId,
      qtyChange: parsed.data.qtyChange,
      reason: parsed.data.reason
    });
    return reply.send({ ok: true, result: out });
  } catch (e) {
    if (e.code === "INSUFFICIENT_STOCK") {
      return reply.status(409).send({ error: "Insufficient stock" });
    }
    request.log.error(e);
    return reply.status(500).send({ error: "Internal Server Error" });
  }
}

module.exports = { createProduct, listProducts, listInventory, adjustInventory };
