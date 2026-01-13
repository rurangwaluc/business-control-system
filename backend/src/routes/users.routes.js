const ACTIONS = require("../permissions/actions");
const { requirePermission } = require("../middleware/requirePermission");
const { createUser, listUsers, updateUser } = require("../controllers/usersController");


async function usersRoutes(app) {
  app.post("/users", { preHandler: [requirePermission(ACTIONS.USER_MANAGE)] }, createUser);
  app.get("/users", { preHandler: [requirePermission(ACTIONS.USER_MANAGE)] }, listUsers);
  app.patch("/users/:id", { preHandler: [requirePermission(ACTIONS.USER_MANAGE)] }, updateUser);
}

module.exports = { usersRoutes };
