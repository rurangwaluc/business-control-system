const { createSaleSchema, markSaleSchema, cancelSaleSchema } = require("../validators/sales.schema");
const salesService = require("../services/salesService");

async function createSale(request, reply) {
  const parsed = createSaleSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.status(400).send({ error: "Invalid payload", details: parsed.error.flatten() });
  }

  try {
    const sale = await salesService.createSale({
      locationId: request.user.locationId,
      sellerId: request.user.id,
      customerId: parsed.data.customerId,
      note: parsed.data.note,
      items: parsed.data.items
    });

    return reply.send({ ok: true, sale });
  } catch (e) {
    if (e.code === "INSUFFICIENT_SELLER_STOCK") {
      return reply.status(409).send({ error: "Insufficient seller stock" });
    }
    request.log.error(e);
    return reply.status(500).send({ error: "Internal Server Error" });
  }
}

async function markSale(request, reply) {
  const parsed = markSaleSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.status(400).send({ error: "Invalid payload", details: parsed.error.flatten() });
  }

  try {
    const sale = await salesService.markSale({
      locationId: request.user.locationId,
      sellerId: request.user.id,
      saleId: Number(request.params.id),
      status: parsed.data.status // ✅ use status
    });

    return reply.send({ ok: true, sale });
  } catch (e) {
    if (e.code === "NOT_FOUND") return reply.status(404).send({ error: "Sale not found" });
    if (e.code === "FORBIDDEN") return reply.status(403).send({ error: "Forbidden" });
    if (e.code === "BAD_STATUS") {
      return reply.status(409).send({
        error: "Invalid status",
        details: e.details || null
      });
}


    request.log.error(e);
    return reply.status(500).send({ error: "Internal Server Error" });
  }
}

async function cancelSale(request, reply) {
  const parsed = cancelSaleSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.status(400).send({ error: "Invalid payload", details: parsed.error.flatten() });
  }

  try {
    const sale = await salesService.cancelSale({
      locationId: request.user.locationId,
      actorId: request.user.id,
      saleId: Number(request.params.id),
      reason: parsed.data.reason
    });

    return reply.send({ ok: true, sale });
  } catch (e) {
    if (e.code === "NOT_FOUND") return reply.status(404).send({ error: "Sale not found" });
    if (e.code === "BAD_STATUS") return reply.status(409).send({ error: "Invalid status" });

    request.log.error(e);
    return reply.status(500).send({ error: "Internal Server Error" });
  }
}

module.exports = { createSale, markSale, cancelSale };
