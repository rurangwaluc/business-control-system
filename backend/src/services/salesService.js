const { db } = require("../config/db");
const { sales } = require("../db/schema/sales.schema");
const { saleItems } = require("../db/schema/sale_items.schema");
const { products } = require("../db/schema/products.schema");
const { sellerHoldings } = require("../db/schema/seller_holdings.schema");
const { auditLogs } = require("../db/schema/audit_logs.schema");
const { messages } = require("../db/schema/messages.schema"); // if you already created messages; otherwise remove this line
const { eq, and } = require("drizzle-orm");

async function createSale({ locationId, sellerId, customerId, customerName, customerPhone, note, items }) {
  return db.transaction(async (tx) => {
    let total = 0;
    const lines = [];

    for (const it of items) {
      const prodRows = await tx.select().from(products)
        .where(and(eq(products.id, it.productId), eq(products.locationId, locationId)));
      const prod = prodRows[0];
      if (!prod) throw new Error("Product not found");

      await tx.insert(sellerHoldings)
        .values({ locationId, sellerId, productId: it.productId, qtyOnHand: 0 })
        .onConflictDoNothing();

      const holdRows = await tx.select().from(sellerHoldings).where(and(
        eq(sellerHoldings.locationId, locationId),
        eq(sellerHoldings.sellerId, sellerId),
        eq(sellerHoldings.productId, it.productId)
      ));
      const holding = holdRows[0];

      const newQty = holding.qtyOnHand - it.qty;
      if (newQty < 0) {
        const err = new Error("Insufficient seller stock");
        err.code = "INSUFFICIENT_SELLER_STOCK";
        throw err;
      }

      await tx.update(sellerHoldings)
        .set({ qtyOnHand: newQty, updatedAt: new Date() })
        .where(eq(sellerHoldings.id, holding.id));

      const unitPrice = prod.sellingPrice;
      const lineTotal = unitPrice * it.qty;
      total += lineTotal;

      lines.push({ productId: it.productId, qty: it.qty, unitPrice, lineTotal });
    }

    // Insert sale with new snake_case columns
    const [createdSale] = await tx.insert(sales).values({
  locationId,
  sellerId,
  customerId: customerId || null,

  // ✅ MUST use schema property names
  customerName: customerName || null,
  customerPhone: customerPhone || null,

  status: "DRAFT",
  totalAmount: total,
  note: note || null,
  updatedAt: new Date()
}).returning();


    await tx.insert(saleItems).values(
      lines.map(l => ({
        saleId: createdSale.id,
        productId: l.productId,
        qty: l.qty,
        unitPrice: l.unitPrice,
        lineTotal: l.lineTotal
      }))
    );

    await tx.insert(auditLogs).values({
      userId: sellerId,
      action: "SALE_CREATE",
      entity: "sale",
      entityId: createdSale.id,
      description: `Seller created sale #${createdSale.id} total=${total}`
    });

    return createdSale;
  });
}

// ✅ FIXED: accepts status = "PAID" | "PENDING"
async function markSale({ locationId, sellerId, saleId, status }) {
  // map external mark to internal status
  const nextStatus = status === "PAID" ? "AWAITING_PAYMENT_RECORD" : "PENDING";

  const rows = await db.select().from(sales)
    .where(and(eq(sales.id, saleId), eq(sales.locationId, locationId)));

  const sale = rows[0];
  if (!sale) {
    const err = new Error("Sale not found");
    err.code = "NOT_FOUND";
    throw err;
  }

  if (sale.sellerId !== sellerId) {
    const err = new Error("Forbidden");
    err.code = "FORBIDDEN";
    throw err;
  }

  // ✅ Only allow marking from DRAFT (clean control)
 if (sale.status !== "DRAFT") {
  const err = new Error("Invalid status");
  err.code = "BAD_STATUS";
  err.details = {
    currentStatus: sale.status,
    expected: ["DRAFT"],
    note: "You can only mark a sale once, from DRAFT -> (PENDING or AWAITING_PAYMENT_RECORD)"
  };
  throw err;
}


  const [updated] = await db.update(sales)
    .set({ status: nextStatus, updatedAt: new Date() })
    .where(eq(sales.id, saleId))
    .returning();

  await db.insert(auditLogs).values({
    userId: sellerId,
    action: "SALE_MARK",
    entity: "sale",
    entityId: saleId,
    description: `Seller marked sale #${saleId} as ${status} -> ${nextStatus}`
  });

  return updated;
}

async function cancelSale({ locationId, actorId, saleId, reason }) {
  return db.transaction(async (tx) => {
    const rows = await tx.select().from(sales)
      .where(and(eq(sales.id, saleId), eq(sales.locationId, locationId)));
    const sale = rows[0];

    if (!sale) {
      const err = new Error("Sale not found");
      err.code = "NOT_FOUND";
      throw err;
    }

    if (["CANCELED", "COMPLETED"].includes(sale.status)) {
      const err = new Error("Invalid status");
      err.code = "BAD_STATUS";
      throw err;
    }

    const lines = await tx.select().from(saleItems).where(eq(saleItems.saleId, saleId));

    for (const line of lines) {
      await tx.insert(sellerHoldings)
        .values({ locationId, sellerId: sale.sellerId, productId: line.productId, qtyOnHand: 0 })
        .onConflictDoNothing();

      const holdRows = await tx.select().from(sellerHoldings).where(and(
        eq(sellerHoldings.locationId, locationId),
        eq(sellerHoldings.sellerId, sale.sellerId),
        eq(sellerHoldings.productId, line.productId)
      ));

      const holding = holdRows[0];
      await tx.update(sellerHoldings)
        .set({ qtyOnHand: holding.qtyOnHand + line.qty, updatedAt: new Date() })
        .where(eq(sellerHoldings.id, holding.id));
    }

    const [updated] = await tx.update(sales).set({
      status: "CANCELED",
      canceledAt: new Date(),
      canceledBy: actorId,
      cancelReason: reason,
      updatedAt: new Date()
    }).where(eq(sales.id, saleId)).returning();

    await tx.insert(auditLogs).values({
      userId: actorId,
      action: "SALE_CANCEL",
      entity: "sale",
      entityId: saleId,
      description: `Sale #${saleId} canceled. Reason: ${reason}`
    });

    // Optional system message if you already have messages module/table:
    // await tx.insert(messages).values({
    //   locationId,
    //   entityType: "sale",
    //   entityId: saleId,
    //   userId: actorId,
    //   role: "system",
    //   message: `Sale canceled. Reason: ${reason}`,
    //   isSystem: 1
    // });

    return updated;
  });
}

module.exports = { createSale, markSale, cancelSale };
