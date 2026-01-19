const fastify = require("fastify");
const rateLimit = require("@fastify/rate-limit");
const cors = require("@fastify/cors");
const cookie = require("@fastify/cookie");
const { env } = require("./config/env");
const { sessionAuth } = require("./middleware/sessionAuth");
const { authRoutes } = require("./routes/auth.routes");
const { dashboardRoutes } = require("./routes/dashboard.routes");
const { inventoryRoutes } = require("./routes/inventory.routes");
const { requestsRoutes } = require("./routes/requests.routes");
const { holdingsRoutes } = require("./routes/holdings.routes");
const { usersRoutes } = require("./routes/users.routes");
const { salesRoutes } = require("./routes/sales.routes");
const { paymentsRoutes } = require("./routes/payments.routes");
const { messagesRoutes } = require("./routes/messages.routes");
const { ownerDashboardRoutes } = require("./routes/dashboard.owner.routes");
const { customersRoutes } = require("./routes/customers.routes");
const { auditRoutes } = require("./routes/audit.routes");
const { cashRoutes } = require("./routes/cash.routes");
const { creditRoutes } = require("./routes/credit.routes");
const { salesReadRoutes } = require("./routes/sales.read.routes");
const { creditReadRoutes } = require("./routes/credit.read.routes");

function buildApp() {
  // const app = fastify({ logger: true, trustProxy: true });
  const app = fastify({ logger: true });

  app.register(cors, {
    origin: env.CORS_ORIGIN ? env.CORS_ORIGIN.split(",") : true,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  });

  app.register(cookie);

  // attach user on every request
  app.addHook("preHandler", sessionAuth);

  app.get("/health", async () => {
    return { status: "ok", timestamp: new Date().toISOString() };
  });

  app.register(rateLimit, {
    global: false,
  });

  // routes
  app.register(authRoutes);
  app.register(dashboardRoutes);
  app.register(inventoryRoutes);
  app.register(requestsRoutes);
  app.register(holdingsRoutes);
  app.register(usersRoutes);
  app.register(salesRoutes);
  app.register(paymentsRoutes);
  app.register(messagesRoutes);
  app.register(ownerDashboardRoutes);
  app.register(customersRoutes);
  app.register(auditRoutes);
  app.register(cashRoutes);
  app.register(creditRoutes);
  app.register(salesReadRoutes);
  app.register(creditReadRoutes);

  app.setErrorHandler((error, request, reply) => {
    request.log.error(error);

    const statusCode = error.statusCode || 500;
    const message =
      statusCode === 429
        ? "Too Many Requests"
        : error.message || "Internal Server Error";

    reply.status(statusCode).send({ error: message });
  });

  return app;
}

module.exports = { buildApp };
