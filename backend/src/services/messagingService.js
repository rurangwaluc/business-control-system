const { db } = require("../config/db");
const { messages } = require("../db/schema/messages.schema");
const { eq, and, asc } = require("drizzle-orm");

async function postMessage({ locationId, entityType, entityId, user }) {
  await db.insert(messages).values({
    locationId,
    entityType,
    entityId,
    userId: user.id,
    role: user.role,
    message: user.message,
    isSystem: user.isSystem ? 1 : 0
  });
}

async function listMessages({ locationId, entityType, entityId }) {
  const rows = await db
    .select()
    .from(messages)
    .where(
      and(
        eq(messages.locationId, locationId),
        eq(messages.entityType, entityType),
        eq(messages.entityId, entityId)
      )
    )
    .orderBy(asc(messages.createdAt));

  return rows;
}

module.exports = { postMessage, listMessages };
