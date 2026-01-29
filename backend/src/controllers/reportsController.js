const PDFDocument = require("pdfkit");

const {
  dayRange,
  weekRange,
  monthRange,
  salesAndPaymentsSummary,
  inventorySnapshot,
  sellerHoldingsSnapshot,
} = require("../services/reportsService");

function money(n) {
  const x = Number(n || 0);
  return x.toLocaleString();
}

function safe(v) {
  return v == null ? "-" : String(v);
}

function addTable(doc, { title, headers, rows }) {
  doc.moveDown(0.7);
  doc.fontSize(13).text(title, { underline: true });
  doc.moveDown(0.4);

  doc.fontSize(10);
  doc.text(headers.join(" | "));
  doc.moveDown(0.2);
  doc.text("-".repeat(90));
  doc.moveDown(0.2);

  for (const r of rows) {
    doc.text(r.join(" | "));
  }
}

async function dailyReport(request, reply) {
  const { date } = request.query;
  const range = dayRange(date);
  if (!range) return reply.status(400).send({ error: "Invalid date" });

  const locationId = request.user.locationId;

  const summary = await salesAndPaymentsSummary({
    locationId,
    start: range.start,
    end: range.end,
  });

  // NEW: snapshots for manager/admin/owner visibility
  const inv = await inventorySnapshot({ locationId, limit: 50 });
  const holds = await sellerHoldingsSnapshot({ locationId, limit: 100 });

  const doc = new PDFDocument({ margin: 40 });
  reply.header("Content-Type", "application/pdf");
  reply.header(
    "Content-Disposition",
    `attachment; filename="daily-report-${date}.pdf"`,
  );

  doc.pipe(reply.raw);

  doc.fontSize(18).text(`Daily Report (${date})`);
  doc.moveDown();

  doc.fontSize(12).text(`Location: ${locationId}`);
  doc.moveDown();

  doc.fontSize(12).text(`Sales count: ${summary.salesCount}`);
  doc.text(`Sales total: ${money(summary.salesTotal)}`);
  doc.moveDown(0.5);

  doc.text(`Payments count: ${summary.paymentsCount}`);
  doc.text(`Payments total: ${money(summary.paymentsTotal)}`);

  // Inventory snapshot
  addTable(doc, {
    title: "Warehouse Inventory Snapshot (Top 50)",
    headers: [
      "ID",
      "Name",
      "SKU",
      "Qty",
      "Cost",
      "Sell",
      "Value@Cost",
      "Value@Sell",
    ],
    rows: inv.map((x) => [
      safe(x.id),
      safe(x.name),
      safe(x.sku),
      money(x.qtyOnHand),
      money(x.costPrice),
      money(x.sellingPrice),
      money(x.stockValueCost),
      money(x.stockValueSell),
    ]),
  });

  // Seller holdings snapshot
  addTable(doc, {
    title: "Seller Holdings Snapshot (Top 100)",
    headers: ["Seller", "Product", "SKU", "Qty"],
    rows: holds.map((x) => [
      safe(x.sellerId),
      `${safe(x.productId)} • ${safe(x.productName)}`,
      safe(x.sku),
      money(x.qtyOnHand),
    ]),
  });

  doc.end();
}

async function weeklyReport(request, reply) {
  const { start } = request.query;
  const range = weekRange(start);
  if (!range) return reply.status(400).send({ error: "Invalid start date" });

  const locationId = request.user.locationId;
  const summary = await salesAndPaymentsSummary({
    locationId,
    start: range.start,
    end: range.end,
  });

  const doc = new PDFDocument({ margin: 40 });
  reply.header("Content-Type", "application/pdf");
  reply.header(
    "Content-Disposition",
    `attachment; filename="weekly-report-${start}.pdf"`,
  );

  doc.pipe(reply.raw);

  doc.fontSize(18).text(`Weekly Report (start ${start})`);
  doc.moveDown();
  doc.fontSize(12).text(`Location: ${locationId}`);
  doc.moveDown();

  doc.text(`Sales count: ${summary.salesCount}`);
  doc.text(`Sales total: ${money(summary.salesTotal)}`);
  doc.moveDown(0.5);

  doc.text(`Payments count: ${summary.paymentsCount}`);
  doc.text(`Payments total: ${money(summary.paymentsTotal)}`);

  doc.end();
}

async function monthlyReport(request, reply) {
  const { month } = request.query; // YYYY-MM
  const range = monthRange(month);
  if (!range) return reply.status(400).send({ error: "Invalid month" });

  const locationId = request.user.locationId;
  const summary = await salesAndPaymentsSummary({
    locationId,
    start: range.start,
    end: range.end,
  });

  const doc = new PDFDocument({ margin: 40 });
  reply.header("Content-Type", "application/pdf");
  reply.header(
    "Content-Disposition",
    `attachment; filename="monthly-report-${month}.pdf"`,
  );

  doc.pipe(reply.raw);

  doc.fontSize(18).text(`Monthly Report (${month})`);
  doc.moveDown();
  doc.fontSize(12).text(`Location: ${locationId}`);
  doc.moveDown();

  doc.text(`Sales count: ${summary.salesCount}`);
  doc.text(`Sales total: ${money(summary.salesTotal)}`);
  doc.moveDown(0.5);

  doc.text(`Payments count: ${summary.paymentsCount}`);
  doc.text(`Payments total: ${money(summary.paymentsTotal)}`);

  doc.end();
}

module.exports = { dailyReport, weeklyReport, monthlyReport };
