const { pgTable, serial, integer, varchar, timestamp, text } = require("drizzle-orm/pg-core");

const cashLedger = pgTable("cash_ledger", {
  id: serial("id").primaryKey(),

  locationId: integer("location_id").notNull(),
  cashierId: integer("cashier_id").notNull(),

  // SALE_PAYMENT, PETTY_CASH_IN, PETTY_CASH_OUT, VERSEMENT, OPENING_BALANCE
  type: varchar("type", { length: 40 }).notNull(),

  // IN / OUT
  direction: varchar("direction", { length: 10 }).notNull(),

  amount: integer("amount").notNull(),

  // CASH / MOMO / BANK (versement)
  method: varchar("method", { length: 20 }).default("CASH"),

  saleId: integer("sale_id"),
  paymentId: integer("payment_id"),

  note: text("note"),

  createdAt: timestamp("created_at").defaultNow()
});

module.exports = { cashLedger };
