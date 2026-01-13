const { z } = require("zod");
const messageService = require("../services/messagingService");

const createMessageSchema = z.object({
  entityType: z.enum(["stock_request", "sale", "inventory"]),
  entityId: z.number().int().positive(),
  message: z.string().min(1)
});

async function createMessage(request, reply) {
  const parsed = createMessageSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.status(400).send({ error: "Invalid payload" });
  }

  await messageService.postMessage({
    locationId: request.user.locationId,
    entityType: parsed.data.entityType,
    entityId: parsed.data.entityId,
    user: {
      id: request.user.id,
      role: request.user.role,
      message: parsed.data.message
    }
  });

  return reply.send({ ok: true });
}

async function getMessages(request, reply) {
  if (!request.user) return reply.status(401).send({ error: "Unauthorized" });

  const rows = await messageService.listMessages({
    locationId: request.user.locationId,
    entityType: request.params.entityType,
    entityId: Number(request.params.entityId)
  });

  return reply.send({ ok: true, messages: rows });
}


module.exports = { createMessage, getMessages };
