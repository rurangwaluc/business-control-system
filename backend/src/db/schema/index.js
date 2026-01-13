const { users } = require("./users.schema");
const { sessions } = require("./sessions.schema");
const { auditLogs } = require("./audit_logs.schema");
const { products } = require("./products.schema");
const { inventoryBalances } = require("./inventory.schema");
const { stockRequests } = require("./stock_requests.schema");
const { stockRequestItems } = require("./stock_request_items.schema");
const { sellerHoldings } = require("./seller_holdings.schema"); 
const { sales } = require("./sales.schema");
const { saleItems } = require("./sale_items.schema");
const { payments } = require("./payments.schema");
const { messages } = require("./messages.schema");
const { customers } = require("./customers.schema");
const { cashLedger } = require("./cash_ledger.schema");
const { credits } = require("./credits.schema");



module.exports = {
  users,
  sessions,
  auditLogs,
   products,
  inventoryBalances,
   stockRequests,
  stockRequestItems,
  sellerHoldings,
  sales,
  saleItems,
  payments,
  messages,
  customers,
  cashLedger,
  credits 
};
