const creditReadService = require("../services/creditReadService");

async function getCredit(request, reply) {
  const creditId = Number(request.params.id);
  if (!creditId) return reply.status(400).send({ error: "Invalid credit id" });

  const credit = await creditReadService.getCreditById({
    locationId: request.user.locationId,
    creditId
  });

  if (!credit) return reply.status(404).send({ error: "Credit not found" });

  return reply.send({ ok: true, credit });
}

async function listCredits(request, reply) {
  const credits = await creditReadService.listCredits({
    locationId: request.user.locationId,
    status: request.query.status || null,
    q: request.query.q || null,
    limit: request.query.limit || 50
  });

  return reply.send({ ok: true, credits });
}

module.exports = { getCredit, listCredits };
