const ACTIONS = require("../permissions/actions");
const { requirePermission } = require("../middleware/requirePermission");
const { getCredit, listCredits } = require("../controllers/creditReadController");

async function creditReadRoutes(app) {
  app.get("/credits/:id", { preHandler: [requirePermission(ACTIONS.CREDIT_VIEW || ACTIONS.CREDIT_READ)] }, getCredit);
  app.get("/credits", { preHandler: [requirePermission(ACTIONS.CREDIT_VIEW || ACTIONS.CREDIT_READ)] }, listCredits);
}

module.exports = { creditReadRoutes };
