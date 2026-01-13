const { db } = require("../config/db");
const { sessions } = require("../db/schema/sessions.schema");
const { users } = require("../db/schema/users.schema");
const { eq } = require("drizzle-orm");

async function sessionAuth(request, reply) {
  const token = request.cookies && request.cookies.sid;
  if (!token) {
    request.user = null;
    return;
  }

  const now = new Date();

  const sessionRows = await db
    .select()
    .from(sessions)
    .where(eq(sessions.sessionToken, token));

  const session = sessionRows[0];
  if (!session || session.expiresAt <= now) {
    request.user = null;
    return;
  }

  const userRows = await db
    .select({
      id: users.id,
      locationId: users.locationId,
      name: users.name,
      email: users.email,
      role: users.role,
      isActive: users.isActive
    })
    .from(users)
    .where(eq(users.id, session.userId));

  const user = userRows[0];
  if (!user || user.isActive === false) {
    request.user = null;
    return;
  }

  request.user = user;
}

module.exports = { sessionAuth };
