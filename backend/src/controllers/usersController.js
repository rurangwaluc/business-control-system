const { createUserSchema, updateUserSchema  } = require("../validators/users.schema");
const userService = require("../services/userService");

async function createUser(request, reply) {
  const parsed = createUserSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.status(400).send({ error: "Invalid payload", details: parsed.error.flatten() });
  }

  try {
    const user = await userService.createUser({
      adminUser: request.user,
      data: parsed.data
    });
    return reply.send({ ok: true, user });
  } catch (e) {
    if (e.code === "DUPLICATE_EMAIL") {
      return reply.status(409).send({ error: "Email already exists" });
    }
    request.log.error(e);
    return reply.status(500).send({ error: "Internal Server Error" });
  }
}

async function listUsers(request, reply) {
  const rows = await userService.listUsers({ adminUser: request.user });
  return reply.send({ ok: true, users: rows });
}

async function updateUser(request, reply) {
  const userId = Number(request.params.id);
  if (!userId) return reply.status(400).send({ error: "Invalid user id" });

  const parsed = updateUserSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.status(400).send({ error: "Invalid payload", details: parsed.error.flatten() });
  }

  try {
    const user = await userService.updateUser({
      adminUser: request.user,
      targetUserId: userId,
      data: parsed.data
    });
    return reply.send({ ok: true, user });
  } catch (e) {
    if (e.code === "NOT_FOUND") return reply.status(404).send({ error: "User not found" });
    if (e.code === "CANNOT_DEACTIVATE_SELF") return reply.status(409).send({ error: "Cannot deactivate self" });

    request.log.error(e);
    return reply.status(500).send({ error: "Internal Server Error" });
  }
}

module.exports = { createUser, listUsers, updateUser };

