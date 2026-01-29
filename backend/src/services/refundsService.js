const { db } = require("../config/db");
const { refunds } = require("../db/schema/refunds.schema");
const { sales } = require("../db/schema/sales.schema");
const { saleItems } = require("../db/schema/sale_items.schema");
const { inventoryBalances } = require("../db/schema/inventory.schema");
const { sellerHoldings } = require("../db/schema/seller_holdings.schema");
const { cashLedger } = require("../db/schema/cash_ledger.schema");
const { auditLogs } = require("../db/schema/audit_logs.schema");
const { eq, and, sql } = require("drizzle-orm");

function toInt(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  return Math.round(x);
}

async function createRefund({ locationId, userId, saleId, reason }) {
  return db.transaction(async (tx) => {
    // 1) Load sale
    const saleRows = await tx
      .select()
      .from(sales)
      .where(and(eq(sales.id, saleId), eq(sales.locationId, locationId)));
    const sale = saleRows[0];
    if (!sale) {
      const err = new Error("Sale not found");
      err.code = "NOT_FOUND";
      throw err;
    }

    // 2) Only COMPLETED can be refunded (Phase 1)
    if (String(sale.status) !== "COMPLETED") {
      const err = new Error("Sale not refundable");
      err.code = "BAD_STATUS";
      err.debug = { status: sale.status };
      throw err;
    }

    // prevent double refunds
    const existing = await tx.execute(sql`
      SELECT id FROM refunds
      WHERE location_id = ${locationId} AND sale_id = ${saleId}
      LIMIT 1
    `);
    const existingRows = existing.rows || existing;
    if (existingRows.length > 0) {
      const err = new Error("Already refunded");
      err.code = "ALREADY_REFUNDED";
      throw err;
    }

    // 3) Load sale items
    const items = await tx.select().from(saleItems).where(eq(saleItems.saleId, saleId));
    if (!items.length) {
      const err = new Error("Sale has no items");
      err.code = "BAD_STATUS";
      err.debug = { reason: "NO_ITEMS" };
      throw err;
    }

    // 4) Restore stock (inventory + seller holdings) - mirrors cancelSale restore
    for (const it of items) {
      const pid = Number(it.productId);
      const qty = toInt(it.qty);

      // ensure inventory row exists
      await tx.insert(inventoryBalances).values({ locationId, productId: pid, qtyOnHand: 0 }).onConflictDoNothing();
      await tx.execute(sql`
        UPDATE inventory_balances
        SET qty_on_hand = qty_on_hand + ${qty},
            updated_at = now()
        WHERE location_id = ${locationId}
          AND product_id = ${pid}
      `);

      // ensure seller holdings row exists and restore to seller who made the sale
      await tx.insert(sellerHoldings).values({ locationId, sellerId: sale.sellerId, productId: pid, qtyOnHand: 0 }).onConflictDoNothing();
      await tx.execute(sql`
        UPDATE seller_holdings
        SET qty_on_hand = qty_on_hand + ${qty},
            updated_at = now()
        WHERE location_id = ${locationId}
          AND seller_id = ${sale.sellerId}
          AND product_id = ${pid}
      `);
    }

    const amount = toInt(sale.totalAmount);

    // 5) Create refund record
    const [createdRefund] = await tx.insert(refunds).values({
      locationId,
      saleId,
      amount,
      reason: reason || null,
      createdByUserId: userId,
      createdAt: new Date(),
    }).returning();

    // 6) Cash ledger OUT entry
    await tx.insert(cashLedger).values({
      locationId,
      cashierId: userId,
      type: "REFUND",
      direction: "OUT",
      amount,
      method: "CASH",
      saleId,
      note: reason ? `Refund: ${String(reason).slice(0, 180)}` : "Refund issued",
    });

    // 7) Mark sale REFUNDED
    const [updatedSale] = await tx.update(sales)
      .set({ status: "REFUNDED", updatedAt: new Date() })
      .where(eq(sales.id, saleId))
      .returning();

    // 8) Audit
    await tx.insert(auditLogs).values({
      userId,
      action: "REFUND_CREATE",
      entity: "sale",
      entityId: saleId,
      description: `Refund created for sale #${saleId}, amount=${amount}`,
    });

    return { refund: createdRefund, sale: updatedSale };
  });
}

async function listRefunds({ locationId }) {
  const result = await db.execute(sql`
    SELECT r.id, r.sale_id as "saleId", r.amount, r.reason,
           r.created_by_user_id as "createdByUserId",
           r.created_at as "createdAt"
    FROM refunds r
    WHERE r.location_id = ${locationId}
    ORDER BY r.id DESC
    LIMIT 200
  `);
  return result.rows || result;
}

module.exports = { createRefund, listRefunds };
