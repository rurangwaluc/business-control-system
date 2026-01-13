const ACTIONS = require("../permissions/actions");
const { requirePermission } = require("../middleware/requirePermission");
const { listAudits } = require("../controllers/auditController");

async function auditRoutes(app) {
  app.get("/audit", { preHandler: [requirePermission(ACTIONS.AUDIT_VIEW)] }, listAudits);
}

module.exports = { auditRoutes };
