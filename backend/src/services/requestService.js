const { db } = require("../config/db");
const { stockRequests } = require("../db/schema/stock_requests.schema");
const { stockRequestItems } = require("../db/schema/stock_request_items.schema");
const { inventoryBalances } = require("../db/schema/inventory.schema");
const { sellerHoldings } = require("../db/schema/seller_holdings.schema");
const { auditLogs } = require("../db/schema/audit_logs.schema");
const { eq, and } = require("drizzle-orm");

async function createRequest({ locationId, sellerId, note, items }) {
  return db.transaction(async (tx) => {
    const [req] = await tx
      .insert(stockRequests)
      .values({ locationId, sellerId, status: "PENDING", note: note || null })
      .returning();

    const rows = items.map((i) => ({
      requestId: req.id,
      productId: i.productId,
      qtyRequested: i.qtyRequested,
      qtyApproved: 0
    }));

    await tx.insert(stockRequestItems).values(rows);

    await tx.insert(auditLogs).values({
      userId: sellerId,
      action: "STOCK_REQUEST_CREATE",
      entity: "stock_request",
      entityId: req.id,
      description: `Seller created stock request #${req.id}`
    });

    return req;
  });
}

async function approveOrReject({ locationId, requestId, managerId, decision, note, items }) {
  return db.transaction(async (tx) => {
    const reqRows = await tx.select().from(stockRequests)
      .where(and(eq(stockRequests.id, requestId), eq(stockRequests.locationId, locationId)));

    const req = reqRows[0];
    if (!req) throw new Error("Request not found");
    if (req.status !== "PENDING") {
      const err = new Error("Invalid status");
      err.code = "BAD_STATUS";
      throw err;
    }

    if (decision === "REJECT") {
      await tx.update(stockRequests).set({
        status: "REJECTED",
        note: note || req.note,
        decidedAt: new Date(),
        decidedBy: managerId
      }).where(eq(stockRequests.id, requestId));

      await tx.insert(auditLogs).values({
        userId: managerId,
        action: "STOCK_REQUEST_REJECT",
        entity: "stock_request",
        entityId: requestId,
        description: `Stock request #${requestId} rejected`
      });

      return { id: requestId, status: "REJECTED" };
    }

    // APPROVE: qtyApproved per item (default: full qtyRequested if items not provided)
    const itemRows = await tx.select().from(stockRequestItems).where(eq(stockRequestItems.requestId, requestId));

    const approvedMap = new Map();
    if (items && items.length) {
      for (const it of items) approvedMap.set(it.productId, it.qtyApproved);
    }

    for (const line of itemRows) {
      const qtyApproved = approvedMap.has(line.productId) ? approvedMap.get(line.productId) : line.qtyRequested;
      await tx.update(stockRequestItems)
        .set({ qtyApproved })
        .where(eq(stockRequestItems.id, line.id));
    }

    await tx.update(stockRequests).set({
      status: "APPROVED",
      note: note || req.note,
      decidedAt: new Date(),
      decidedBy: managerId
    }).where(eq(stockRequests.id, requestId));

    await tx.insert(auditLogs).values({
      userId: managerId,
      action: "STOCK_REQUEST_APPROVE",
      entity: "stock_request",
      entityId: requestId,
      description: `Stock request #${requestId} approved`
    });

    return { id: requestId, status: "APPROVED" };
  });
}

async function releaseToSeller({ locationId, requestId, storeKeeperId }) {
  return db.transaction(async (tx) => {
    const reqRows = await tx.select().from(stockRequests)
      .where(and(eq(stockRequests.id, requestId), eq(stockRequests.locationId, locationId)));

    const req = reqRows[0];
    if (!req) throw new Error("Request not found");
    if (req.status !== "APPROVED") {
      const err = new Error("Invalid status");
      err.code = "BAD_STATUS";
      throw err;
    }

    const lines = await tx.select().from(stockRequestItems).where(eq(stockRequestItems.requestId, requestId));

    // Move stock: inventory_balances (store) -> seller_holdings
    for (const line of lines) {
      const qty = line.qtyApproved || 0;
      if (qty <= 0) continue;

      // ensure balance rows exist
      await tx.insert(inventoryBalances)
        .values({ locationId, productId: line.productId, qtyOnHand: 0 })
        .onConflictDoNothing();

      await tx.insert(sellerHoldings)
        .values({ locationId, sellerId: req.sellerId, productId: line.productId, qtyOnHand: 0 })
        .onConflictDoNothing();

      // read store stock
      const balRows = await tx.select().from(inventoryBalances)
        .where(and(eq(inventoryBalances.locationId, locationId), eq(inventoryBalances.productId, line.productId)));

      const storeBal = balRows[0];
      const newStoreQty = storeBal.qtyOnHand - qty;
      if (newStoreQty < 0) {
        const err = new Error("Insufficient store stock for release");
        err.code = "INSUFFICIENT_STOCK";
        throw err;
      }

      await tx.update(inventoryBalances)
        .set({ qtyOnHand: newStoreQty, updatedAt: new Date() })
        .where(and(eq(inventoryBalances.locationId, locationId), eq(inventoryBalances.productId, line.productId)));

      // update seller holding
      const sellerRows = await tx.select().from(sellerHoldings)
        .where(and(
          eq(sellerHoldings.locationId, locationId),
          eq(sellerHoldings.sellerId, req.sellerId),
          eq(sellerHoldings.productId, line.productId)
        ));

      const sh = sellerRows[0];
      const newSellerQty = sh.qtyOnHand + qty;

      await tx.update(sellerHoldings)
        .set({ qtyOnHand: newSellerQty, updatedAt: new Date() })
        .where(eq(sellerHoldings.id, sh.id));
    }

    await tx.update(stockRequests).set({ status: "RELEASED" }).where(eq(stockRequests.id, requestId));

    await tx.insert(auditLogs).values({
      userId: storeKeeperId,
      action: "STOCK_RELEASE_TO_SELLER",
      entity: "stock_request",
      entityId: requestId,
      description: `Released request #${requestId} to seller ${req.sellerId}`
    });

    return { id: requestId, status: "RELEASED" };
  });
}

module.exports = { createRequest, approveOrReject, releaseToSeller };
