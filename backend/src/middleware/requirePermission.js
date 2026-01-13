const { can } = require("../permissions/policy");

function requirePermission(action) {
  return async function (request, reply) {
    if (!request.user) return reply.status(401).send({ error: "Unauthorized" });

    const role = request.user.role;
    const allowed = can(role, action);

    if (!allowed) {
      return reply.status(403).send({ error: "Forbidden" });
    }
  };
}

module.exports = { requirePermission };
