const { db } = require("../config/db");
const { payments } = require("../db/schema/payments.schema");
const { sales } = require("../db/schema/sales.schema");
const { auditLogs } = require("../db/schema/audit_logs.schema");
const { eq, and } = require("drizzle-orm");
const { sql } = require("drizzle-orm");
const { cashLedger } = require("../db/schema/cash_ledger.schema");

async function recordPayment({ locationId, cashierId, saleId, amount, method, note }) {
  return db.transaction(async (tx) => {
    // 1) Load sale (location-safe)
    const saleRows = await tx.select().from(sales)
      .where(and(eq(sales.id, saleId), eq(sales.locationId, locationId)));

    const sale = saleRows[0];
    if (!sale) {
      const err = new Error("Sale not found");
      err.code = "NOT_FOUND";
      throw err;
    }

    // 2) Status must allow payment recording
    if (!["AWAITING_PAYMENT_RECORD", "PENDING"].includes(sale.status)) {
      const err = new Error("Invalid status");
      err.code = "BAD_STATUS";
      throw err;
    }

    // 3) Phase 1 rule: amount must equal sale total
    if (amount !== sale.totalAmount) {
      const err = new Error("Amount must equal sale total (Phase 1)");
      err.code = "BAD_AMOUNT";
      throw err;
    }

    // 4) Prevent double payment (check first)
    const existing = await tx.execute(sql`
      SELECT id FROM payments
      WHERE sale_id = ${saleId}
      LIMIT 1
    `);

    const existingRows = existing.rows || existing;
    if (existingRows.length > 0) {
      const err = new Error("Payment already recorded");
      err.code = "DUPLICATE_PAYMENT";
      throw err;
    }

    // 5) Insert payment
    await tx.insert(payments).values({
      locationId,
      saleId,
      cashierId,
      amount,
      method: method || "CASH",
      note: note || null
    });

    // ✅ cash ledger entry for this payment
      await tx.insert(cashLedger).values({
        locationId,
        cashierId,
        type: "SALE_PAYMENT",
        direction: "IN",
        amount,
        method: method || "CASH",
        saleId,
        // paymentId is not available unless you return it. Phase 1: optional.
        note: "Sale payment recorded"
      });


    // 6) Mark sale completed
    const [updated] = await tx.update(sales)
      .set({ status: "COMPLETED", updatedAt: new Date() })
      .where(eq(sales.id, saleId))
      .returning();

    // 7) Audit
    await tx.insert(auditLogs).values({
      userId: cashierId,
      action: "PAYMENT_RECORD",
      entity: "sale",
      entityId: saleId,
      description: `Payment recorded for sale #${saleId}, amount=${amount}, method=${method || "CASH"}`
    });

    return updated;
  });
}

module.exports = { recordPayment };
