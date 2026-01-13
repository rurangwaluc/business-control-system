const ACTIONS = require("../permissions/actions");
const { requirePermission } = require("../middleware/requirePermission");
const {
  createProduct,
  listProducts,
  listInventory,
  adjustInventory
} = require("../controllers/inventoryController");

async function inventoryRoutes(app) {
  // products
  app.post("/products", { preHandler: [requirePermission(ACTIONS.PRODUCT_CREATE)] }, createProduct);
  app.get("/products", { preHandler: [requirePermission(ACTIONS.PRODUCT_VIEW)] }, listProducts);

  // inventory
  app.get("/inventory", { preHandler: [requirePermission(ACTIONS.INVENTORY_VIEW)] }, listInventory);
  app.post(
    "/inventory/adjust",
    {
      preHandler: [requirePermission(ACTIONS.INVENTORY_ADJUST)],
      config: { rateLimit: { max: 60, timeWindow: "1 minute" } }
    },
    adjustInventory
  );

}

module.exports = { inventoryRoutes };
