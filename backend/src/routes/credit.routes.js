const ACTIONS = require("../permissions/actions");
const { requirePermission } = require("../middleware/requirePermission");
const {
  createCredit,
  approveCredit,
  settleCredit,
  listOpenCredits,
  getCreditBySale
} = require("../controllers/creditController");

async function creditRoutes(app) {
  // Seller creates credit record for PENDING sale
  app.post("/credits", { preHandler: [requirePermission(ACTIONS.SALE_MARK_PAID_OR_PENDING)] }, createCredit);

  // Manager/Admin approves/rejects credit
  app.post("/credits/:id/decision", { preHandler: [requirePermission(ACTIONS.CREDIT_APPROVE)] }, approveCredit);

  // Cashier settles credit (creates payment + ledger)
  app.post("/credits/settle", { preHandler: [requirePermission(ACTIONS.CREDIT_SETTLE)] }, settleCredit);

  // View open credits (manager/cashier/admin)
  app.get("/credits/open", { preHandler: [requirePermission(ACTIONS.CREDIT_VIEW)] }, listOpenCredits);

  app.get(
  "/credits/by-sale/:saleId",
  { preHandler: [requirePermission(ACTIONS.CREDIT_VIEW)] },
  getCreditBySale
);

}

module.exports = { creditRoutes };
