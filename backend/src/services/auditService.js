const { db } = require("../config/db");
const { auditLogs } = require("../db/schema/audit_logs.schema");

async function logAudit({
  userId,
  action,
  entity,
  entityId,
  description,
  meta
}) {
  await db.insert(auditLogs).values({
    userId,
    action,
    entity,
    entityId,
    description,
    meta: meta ? JSON.stringify(meta) : null
  });
}

module.exports = { logAudit };
