const ACTIONS = require("../permissions/actions");
const { requirePermission } = require("../middleware/requirePermission");
const { createMessage, getMessages } = require("../controllers/messagesController");

async function messagesRoutes(app) {
  app.post("/messages", { preHandler: [requirePermission(ACTIONS.MESSAGE_CREATE)] }, createMessage);

  // For Phase 1, require user to be authenticated (MESSAGE_CREATE works for all roles already in your policy)
  app.get("/messages/:entityType/:entityId", { preHandler: [requirePermission(ACTIONS.MESSAGE_CREATE)] }, getMessages);
}

module.exports = { messagesRoutes };
