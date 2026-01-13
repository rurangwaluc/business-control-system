function requireStatus(getEntityFn, allowedStatuses) {
  return async function (request, reply) {
    if (!request.user) return reply.status(401).send({ error: "Unauthorized" });

    const entity = await getEntityFn(request);
    if (!entity) return reply.status(404).send({ error: "Not found" });

    if (!allowedStatuses.includes(entity.status)) {
      return reply.status(409).send({
        error: "Invalid status for this action",
        allowed: allowedStatuses,
        current: entity.status
      });
    }

    request.entity = entity; // convenience for controllers
  };
}

module.exports = { requireStatus };
