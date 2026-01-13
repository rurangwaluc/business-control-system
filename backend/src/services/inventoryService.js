const { db } = require("../config/db");
const { products } = require("../db/schema/products.schema");
const { inventoryBalances } = require("../db/schema/inventory.schema");
const { auditLogs } = require("../db/schema/audit_logs.schema");
const { eq, and, sql } = require("drizzle-orm");

async function createProduct({ locationId, userId, data }) {
  const [created] = await db
    .insert(products)
    .values({
      locationId,
      name: data.name,
      sku: data.sku || null,
      unit: data.unit || "unit",
      sellingPrice: data.sellingPrice,
      costPrice: data.costPrice ?? 0,
      notes: data.notes || null
    })
    .returning();

  // Create inventory balance row (0) so it exists
  await db
    .insert(inventoryBalances)
    .values({
      locationId,
      productId: created.id,
      qtyOnHand: 0
    })
    .onConflictDoNothing();

  await db.insert(auditLogs).values({
    userId,
    action: "PRODUCT_CREATE",
    entity: "product",
    entityId: created.id,
    description: `Created product: ${created.name}`
  });

  return created;
}

async function listProducts({ locationId }) {
  return db
    .select({
      id: products.id,
      name: products.name,
      sku: products.sku,
      unit: products.unit,
      sellingPrice: products.sellingPrice,
      costPrice: products.costPrice,
      isActive: products.isActive,
      createdAt: products.createdAt
    })
    .from(products)
    .where(eq(products.locationId, locationId));
}

async function getInventoryBalances({ locationId }) {
  // Join products + balances
  return db.execute(sql`
    SELECT p.id, p.name, p.sku, p.unit, p.selling_price as "sellingPrice",
           b.qty_on_hand as "qtyOnHand", b.updated_at as "updatedAt"
    FROM products p
    LEFT JOIN inventory_balances b
      ON b.product_id = p.id AND b.location_id = p.location_id
    WHERE p.location_id = ${locationId}
    ORDER BY p.id DESC
  `);
}

async function adjustInventory({ locationId, userId, productId, qtyChange, reason }) {
  // Transaction: lock/update balance
  return db.transaction(async (tx) => {
    // ensure product exists in this location
    const prod = await tx
      .select({ id: products.id, name: products.name })
      .from(products)
      .where(and(eq(products.id, productId), eq(products.locationId, locationId)));

    if (!prod[0]) throw new Error("Product not found");

    // ensure balance row exists
    await tx
      .insert(inventoryBalances)
      .values({ locationId, productId, qtyOnHand: 0 })
      .onConflictDoNothing();

    // read current
    const balRows = await tx
      .select()
      .from(inventoryBalances)
      .where(and(eq(inventoryBalances.locationId, locationId), eq(inventoryBalances.productId, productId)));

    const bal = balRows[0];
    const newQty = (bal.qtyOnHand || 0) + qtyChange;

    if (newQty < 0) {
      const err = new Error("Insufficient stock");
      err.code = "INSUFFICIENT_STOCK";
      throw err;
    }

    await tx
      .update(inventoryBalances)
      .set({ qtyOnHand: newQty, updatedAt: new Date() })
      .where(and(eq(inventoryBalances.locationId, locationId), eq(inventoryBalances.productId, productId)));

    await tx.insert(auditLogs).values({
      userId,
      action: "INVENTORY_ADJUST",
      entity: "inventory_balance",
      entityId: bal.id || null,
      description: `Product ${prod[0].name}: qtyChange=${qtyChange}. Reason: ${reason}`
    });

    return { productId, qtyOnHand: newQty };
  });
}

module.exports = {
  createProduct,
  listProducts,
  getInventoryBalances,
  adjustInventory
};
