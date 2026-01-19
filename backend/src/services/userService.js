const { db } = require("../config/db");
const { users } = require("../db/schema/users.schema");
const { auditLogs } = require("../db/schema/audit_logs.schema");
const { hashPassword } = require("../utils/password");
const { eq, and } = require("drizzle-orm");
const ROLES = require("../permissions/roles");

function isOwner(adminUser) {
  return adminUser?.role === ROLES.OWNER;
}

/**
 * ✅ Phase-1 bootstrap rule:
 * - If there is NO owner yet in this location, allow an admin to create the first owner.
 * - After an owner exists, ONLY an owner can create/assign owner role.
 */
async function locationHasOwner(locationId) {
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.locationId, locationId), eq(users.role, ROLES.OWNER)))
    .limit(1);

  return !!rows[0];
}

async function createUser({ adminUser, data }) {
  // ✅ SECURITY: only allow creating OWNER if:
  // - requester is already an OWNER, OR
  // - there is no owner yet in this location (bootstrap)
  if (data.role === ROLES.OWNER) {
    const hasOwner = await locationHasOwner(adminUser.locationId);
    if (hasOwner && !isOwner(adminUser)) {
      const err = new Error("Only owner can create owner users");
      err.code = "OWNER_ONLY";
      throw err;
    }
  }

  const passwordHash = hashPassword(data.password);

  // prevent duplicates within same location
  const existing = await db
    .select()
    .from(users)
    .where(
      and(
        eq(users.locationId, adminUser.locationId),
        eq(users.email, data.email),
      ),
    );

  if (existing[0]) {
    const err = new Error("Email already exists");
    err.code = "DUPLICATE_EMAIL";
    throw err;
  }

  const [created] = await db
    .insert(users)
    .values({
      locationId: adminUser.locationId,
      name: data.name,
      email: data.email,
      passwordHash,
      role: data.role,
      isActive: data.isActive ?? true,
    })
    .returning();

  await db.insert(auditLogs).values({
    userId: adminUser.id,
    action: "USER_CREATE",
    entity: "user",
    entityId: created.id,
    description: `Created user ${created.email} role=${created.role}`,
  });

  return {
    id: created.id,
    locationId: created.locationId,
    name: created.name,
    email: created.email,
    role: created.role,
    isActive: created.isActive,
    createdAt: created.createdAt,
  };
}

async function listUsers({ adminUser }) {
  const rows = await db
    .select({
      id: users.id,
      locationId: users.locationId,
      name: users.name,
      email: users.email,
      role: users.role,
      isActive: users.isActive,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.locationId, adminUser.locationId));

  return rows;
}

async function updateUser({ adminUser, targetUserId, data }) {
  // prevent self-disable
  if (adminUser.id === targetUserId && data.isActive === false) {
    const err = new Error("Admin cannot deactivate self");
    err.code = "CANNOT_DEACTIVATE_SELF";
    throw err;
  }

  // ✅ SECURITY: Only owner can promote someone to owner
  if (data.role === ROLES.OWNER && !isOwner(adminUser)) {
    const err = new Error("Only owner can promote someone to owner");
    err.code = "OWNER_ONLY";
    throw err;
  }

  const rows = await db
    .select()
    .from(users)
    .where(
      and(
        eq(users.id, targetUserId),
        eq(users.locationId, adminUser.locationId),
      ),
    );

  const target = rows[0];
  if (!target) {
    const err = new Error("User not found");
    err.code = "NOT_FOUND";
    throw err;
  }

  const updates = {};
  if (data.role !== undefined) updates.role = data.role;
  if (data.isActive !== undefined) updates.isActive = data.isActive;

  const [updated] = await db
    .update(users)
    .set(updates)
    .where(eq(users.id, targetUserId))
    .returning();

  const changeParts = [];
  if (data.role !== undefined)
    changeParts.push(`role: ${target.role} -> ${updated.role}`);
  if (data.isActive !== undefined)
    changeParts.push(`isActive: ${target.isActive} -> ${updated.isActive}`);

  await db.insert(auditLogs).values({
    userId: adminUser.id,
    action: "USER_UPDATE",
    entity: "user",
    entityId: updated.id,
    description: `Updated user ${updated.email}. ${changeParts.join(", ")}`,
  });

  return {
    id: updated.id,
    locationId: updated.locationId,
    name: updated.name,
    email: updated.email,
    role: updated.role,
    isActive: updated.isActive,
    createdAt: updated.createdAt,
  };
}

module.exports = { createUser, listUsers, updateUser };
