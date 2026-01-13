const { createCustomerSchema, searchCustomerSchema } = require("../validators/customers.schema");
const customerService = require("../services/customerService");
const { customerHistory } = require("../services/customerHistoryService");

async function createCustomer(request, reply) {
  const parsed = createCustomerSchema.safeParse(request.body);
  if (!parsed.success) return reply.status(400).send({ error: "Invalid payload", details: parsed.error.flatten() });

  const customer = await customerService.createCustomer({
    locationId: request.user.locationId,
    actorId: request.user.id,
    data: parsed.data
  });

  return reply.send({ ok: true, customer });
}

async function searchCustomers(request, reply) {
  const parsed = searchCustomerSchema.safeParse(request.query);
  if (!parsed.success) return reply.status(400).send({ error: "Invalid query" });

  const customers = await customerService.searchCustomers({
    locationId: request.user.locationId,
    q: parsed.data.q
  });

  return reply.send({ ok: true, customers });
}

async function getCustomerHistory(request, reply) {
  const customerId = Number(request.params.id);
  if (!customerId) return reply.status(400).send({ error: "Invalid customer id" });

  const history = await customerHistory({
    locationId: request.user.locationId,
    customerId
  });

  return reply.send({ ok: true, customerId, sales: history });
}

module.exports = { createCustomer, searchCustomers, getCustomerHistory };
