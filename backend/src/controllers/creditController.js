const { createCreditSchema, approveCreditSchema, settleCreditSchema } = require("../validators/credit.schema");
const creditService = require("../services/creditService");

async function createCredit(request, reply) {
  const parsed = createCreditSchema.safeParse(request.body);
  if (!parsed.success) return reply.status(400).send({ error: "Invalid payload", details: parsed.error.flatten() });

  try {
    const credit = await creditService.createCredit({
      locationId: request.user.locationId,
      sellerId: request.user.id,
      saleId: parsed.data.saleId,
      customerId: parsed.data.customerId,
      note: parsed.data.note
    });
    return reply.send({ ok: true, credit });
  } catch (e) {
    if (e.code === "SALE_NOT_FOUND") return reply.status(404).send({ error: "Sale not found" });
    if (e.code === "BAD_STATUS") return reply.status(409).send({ error: "Sale must be PENDING" });
    if (e.code === "DUPLICATE_CREDIT") return reply.status(409).send({ error: "Credit already exists" });

    request.log.error(e);
    return reply.status(500).send({ error: "Internal Server Error" });
  }
}

async function approveCredit(request, reply) {
  const parsed = approveCreditSchema.safeParse(request.body);
  if (!parsed.success) return reply.status(400).send({ error: "Invalid payload", details: parsed.error.flatten() });

  try {
    const out = await creditService.approveCredit({
      locationId: request.user.locationId,
      managerId: request.user.id,
      creditId: Number(request.params.id),
      decision: parsed.data.decision,
      note: parsed.data.note
    });
    return reply.send({ ok: true, result: out });
  } catch (e) {
    if (e.code === "NOT_FOUND") return reply.status(404).send({ error: "Credit not found" });
    if (e.code === "BAD_STATUS") return reply.status(409).send({ error: "Credit already processed" });

    request.log.error(e);
    return reply.status(500).send({ error: "Internal Server Error" });
  }
}

async function settleCredit(request, reply) {
  const parsed = settleCreditSchema.safeParse(request.body);
  if (!parsed.success) return reply.status(400).send({ error: "Invalid payload", details: parsed.error.flatten() });

  try {
    const out = await creditService.settleCredit({
      locationId: request.user.locationId,
      cashierId: request.user.id,
      creditId: parsed.data.creditId,
      method: parsed.data.method,
      note: parsed.data.note
    });
    return reply.send({ ok: true, result: out });
  } catch (e) {
    if (e.code === "NOT_FOUND") return reply.status(404).send({ error: "Credit not found" });
    if (e.code === "BAD_STATUS") return reply.status(409).send({ error: "Credit not open" });
    if (e.code === "NOT_APPROVED") return reply.status(409).send({ error: "Credit must be approved first" });
    if (e.code === "DUPLICATE_PAYMENT") return reply.status(409).send({ error: "Payment already recorded" });

    request.log.error(e);
    return reply.status(500).send({ error: "Internal Server Error" });
  }
}

async function listOpenCredits(request, reply) {
  const q = request.query.q ? String(request.query.q) : null;
  const rows = await creditService.listOpenCredits({
    locationId: request.user.locationId,
    q
  });
  return reply.send({ ok: true, credits: rows });
}

async function getCreditBySale(request, reply) {
  const saleId = Number(request.params.saleId);
  const rows = await require("../services/creditService").getCreditBySale({
    locationId: request.user.locationId,
    saleId
  });
  if (!rows) return reply.status(404).send({ error: "Credit not found" });
  return reply.send({ ok: true, credit: rows });
}


module.exports = { createCredit, approveCredit, settleCredit, listOpenCredits, getCreditBySale };
