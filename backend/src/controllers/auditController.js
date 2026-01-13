const { db } = require("../config/db");
const { auditLogs } = require("../db/schema/audit_logs.schema");
const { desc } = require("drizzle-orm");

async function listAudits(request, reply) {
  const rows = await db.select()
    .from(auditLogs)
    .orderBy(desc(auditLogs.createdAt))
    .limit(50);

  return reply.send({ ok: true, audits: rows });
}

module.exports = { listAudits };
