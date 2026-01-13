const { db } = require("../config/db");
const { users } = require("../db/schema/users.schema");
const { auditLogs } = require("../db/schema/audit_logs.schema");
const { hashPassword } = require("../utils/password");
const { eq, and } = require("drizzle-orm");

async function createUser({ adminUser, data }) {
  const passwordHash = hashPassword(data.password);

  // prevent duplicates
  const existing = await db.select().from(users)
    .where(and(eq(users.locationId, adminUser.locationId), eq(users.email, data.email)));

  if (existing[0]) {
    const err = new Error("Email already exists");
    err.code = "DUPLICATE_EMAIL";
    throw err;
  }

  const [created] = await db.insert(users).values({
    locationId: adminUser.locationId,
    name: data.name,
    email: data.email,
    passwordHash,
    role: data.role,
    isActive: data.isActive ?? true
  }).returning();

  await db.insert(auditLogs).values({
    userId: adminUser.id,
    action: "USER_CREATE",
    entity: "user",
    entityId: created.id,
    description: `Created user ${created.email} role=${created.role}`
  });

  // don’t return password hash
  return {
    id: created.id,
    locationId: created.locationId,
    name: created.name,
    email: created.email,
    role: created.role,
    isActive: created.isActive,
    createdAt: created.createdAt
  };
}

async function listUsers({ adminUser }) {
  const rows = await db.select({
    id: users.id,
    locationId: users.locationId,
    name: users.name,
    email: users.email,
    role: users.role,
    isActive: users.isActive,
    createdAt: users.createdAt
  })
  .from(users)
  .where(eq(users.locationId, adminUser.locationId));

  return rows;
}

async function updateUser({ adminUser, targetUserId, data }) {
  // prevent self-disable (owner locking themselves out)
  if (adminUser.id === targetUserId && data.isActive === false) {
    const err = new Error("Admin cannot deactivate self");
    err.code = "CANNOT_DEACTIVATE_SELF";
    throw err;
  }

  // fetch target user (same location)
  const rows = await db.select().from(users)
    .where(and(eq(users.id, targetUserId), eq(users.locationId, adminUser.locationId)));

  const target = rows[0];
  if (!target) {
    const err = new Error("User not found");
    err.code = "NOT_FOUND";
    throw err;
  }

  const updates = {};
  if (data.role !== undefined) updates.role = data.role;
  if (data.isActive !== undefined) updates.isActive = data.isActive;

  const [updated] = await db.update(users)
    .set(updates)
    .where(eq(users.id, targetUserId))
    .returning();

  // audit with before/after summary
  const changeParts = [];
  if (data.role !== undefined) changeParts.push(`role: ${target.role} -> ${updated.role}`);
  if (data.isActive !== undefined) changeParts.push(`isActive: ${target.isActive} -> ${updated.isActive}`);

  await db.insert(auditLogs).values({
    userId: adminUser.id,
    action: "USER_UPDATE",
    entity: "user",
    entityId: updated.id,
    description: `Updated user ${updated.email}. ${changeParts.join(", ")}`
  });

  return {
    id: updated.id,
    locationId: updated.locationId,
    name: updated.name,
    email: updated.email,
    role: updated.role,
    isActive: updated.isActive,
    createdAt: updated.createdAt
  };
}


module.exports = { createUser, listUsers, updateUser };
