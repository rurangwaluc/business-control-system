const ACTIONS = require("../permissions/actions");
const { requirePermission } = require("../middleware/requirePermission");
const {
  dailyReport,
  weeklyReport,
  monthlyReport,
} = require("../controllers/reportsController");

async function reportsRoutes(app) {
  app.get(
    "/reports/daily",
    { preHandler: [requirePermission(ACTIONS.REPORTS_DOWNLOAD)] },
    dailyReport,
  );

  app.get(
    "/reports/weekly",
    { preHandler: [requirePermission(ACTIONS.REPORTS_DOWNLOAD)] },
    weeklyReport,
  );

  app.get(
    "/reports/monthly",
    { preHandler: [requirePermission(ACTIONS.REPORTS_DOWNLOAD)] },
    monthlyReport,
  );
}

module.exports = { reportsRoutes };
