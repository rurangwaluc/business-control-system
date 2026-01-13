const crypto = require("crypto");
const { db } = require("../config/db");
const { env } = require("../config/env");
const { users } = require("../db/schema/users.schema");
const { sessions } = require("../db/schema/sessions.schema");
const { auditLogs } = require("../db/schema/audit_logs.schema");
const { verifyPassword } = require("../utils/password");
const { eq } = require("drizzle-orm");
const { logAudit } = require("../services/auditService");
const AUDIT = require("../audit/actions");


function makeToken() {
  return crypto.randomBytes(32).toString("hex");
}

async function login(request, reply) {
  const { email, password } = request.body;

  const rows = await db.select().from(users).where(eq(users.email, email));
  const user = rows[0];

  if (!user || user.isActive === false) {
    return reply.status(401).send({ error: "Invalid credentials" });
  }

  const ok = verifyPassword(password, user.passwordHash);
  if (!ok) {
    return reply.status(401).send({ error: "Invalid credentials" });
  }

  console.log("IP:", request.ip);


  const sessionToken = makeToken();
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7); // 7 days

  await db.insert(sessions).values({
    userId: user.id,
    sessionToken,
    expiresAt
  });

  // audit
  await db.insert(auditLogs).values({
    userId: user.id,
    action: "AUTH_LOGIN",
    entity: "session",
    entityId: null,
    description: `User logged in (${user.email})`
  });

  reply.setCookie("sid", sessionToken, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/"
  });

    await logAudit({
    userId: user.id,
    action: AUDIT.LOGIN_SUCCESS,
    entity: "auth",
    entityId: user.id,
    description: "User logged in"
  });

    await logAudit({
    userId: null,
    action: AUDIT.LOGIN_FAILED,
    entity: "auth",
    entityId: null,
    description: `Failed login for ${email}`
  });


  return reply.send({
    ok: true,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      locationId: user.locationId
    }
  });
}

async function me(request, reply) {
  if (!request.user) return reply.status(401).send({ error: "Unauthorized" });
  return reply.send({ user: request.user });
}

async function logout(request, reply) {
  const token = request.cookies && request.cookies.sid;
  if (token) {
    // delete session
    await db.delete(sessions).where(eq(sessions.sessionToken, token));
  }

  reply.clearCookie("sid", { path: "/" });
  return reply.send({ ok: true });
}

module.exports = { login, me, logout };
