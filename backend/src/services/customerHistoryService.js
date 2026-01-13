const { db } = require("../config/db");
const { sql } = require("drizzle-orm");

async function customerHistory({ locationId, customerId }) {
  const res = await db.execute(sql`
    SELECT s.id, s.status, s.total_amount as "totalAmount", s.created_at as "createdAt",
           s.seller_id as "sellerId"
    FROM sales s
    WHERE s.location_id = ${locationId}
      AND s.customer_id = ${customerId}
    ORDER BY s.created_at DESC
    LIMIT 50
  `);

  return res.rows || res;
}

module.exports = { customerHistory };
