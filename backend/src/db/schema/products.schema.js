const { pgTable, serial, varchar, text, boolean, timestamp, integer } = require("drizzle-orm/pg-core");

const products = pgTable("products", {
  id: serial("id").primaryKey(),
  locationId: integer("location_id").notNull(),

  name: varchar("name", { length: 180 }).notNull(),
  sku: varchar("sku", { length: 80 }), // optional
  unit: varchar("unit", { length: 40 }).default("unit"), // piece, kg, etc.
  sellingPrice: integer("selling_price").notNull(), // store as integer cents/units (RWF is integer)
  costPrice: integer("cost_price").default(0),

  isActive: boolean("is_active").default(true),
  notes: text("notes"),

  createdAt: timestamp("created_at").defaultNow()
});

module.exports = { products };
