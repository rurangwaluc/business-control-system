// backend/src/routes/uploads.routes.js
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

async function uploadsRoutes(app) {
  app.post("/uploads", async (request, reply) => {
    const parts = request.parts();

    const uploadDir = path.join(process.cwd(), "uploads");
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

    const urls = [];

    for await (const part of parts) {
      if (part.type !== "file") continue;

      const ext = path.extname(part.filename || "") || "";
      const safeName = crypto.randomBytes(16).toString("hex") + ext;
      const filePath = path.join(uploadDir, safeName);

      await new Promise((resolve, reject) => {
        const ws = fs.createWriteStream(filePath);
        part.file.pipe(ws);
        part.file.on("error", reject);
        ws.on("finish", resolve);
        ws.on("error", reject);
      });

      // serve static from /uploads -> /uploads/<filename>
      urls.push(`/uploads/${safeName}`);
    }

    return reply.send({ ok: true, urls });
  });
}

module.exports = { uploadsRoutes };
