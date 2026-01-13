const { db } = require("../config/db");
const { sql } = require("drizzle-orm");

async function getCreditById({ locationId, creditId }) {
  const res = await db.execute(sql`
    SELECT
      c.id,
      c.location_id as "locationId",
      c.sale_id as "saleId",
      c.customer_id as "customerId",
      c.amount,
      c.status,
      c.created_by as "createdBy",
      c.approved_by as "approvedBy",
      c.approved_at as "approvedAt",
      c.settled_by as "settledBy",
      c.settled_at as "settledAt",
      c.note,
      c.created_at as "createdAt",
      cu.name as "customerName",
      cu.phone as "customerPhone"
    FROM credits c
    JOIN customers cu ON cu.id = c.customer_id
    WHERE c.location_id = ${locationId} AND c.id = ${creditId}
    LIMIT 1
  `);

  const rows = res.rows || res;
  return rows[0] || null;
}

async function listCredits({ locationId, status, q, limit = 50 }) {
  const pattern = q ? `%${q}%` : null;

  const res = await db.execute(sql`
    SELECT
      c.id,
      c.sale_id as "saleId",
      c.customer_id as "customerId",
      cu.name as "customerName",
      cu.phone as "customerPhone",
      c.amount,
      c.status,
      c.approved_at as "approvedAt",
      c.settled_at as "settledAt",
      c.created_at as "createdAt"
    FROM credits c
    JOIN customers cu ON cu.id = c.customer_id
    WHERE c.location_id = ${locationId}
      ${status ? sql`AND c.status = ${status}` : sql``}
      ${pattern ? sql`AND (cu.name ILIKE ${pattern} OR cu.phone ILIKE ${pattern})` : sql``}
    ORDER BY c.created_at DESC
    LIMIT ${Math.min(Math.max(Number(limit) || 50, 1), 200)}
  `);

  return res.rows || res;
}

module.exports = { getCreditById, listCredits };
