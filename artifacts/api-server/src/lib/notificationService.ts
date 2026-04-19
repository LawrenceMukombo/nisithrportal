import { db } from "@workspace/db";
import { notificationsTable, usersTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";

/**
 * Insert a notification for a specific user.
 */
export async function createNotification(params: {
  userId: number;
  type: string;
  message: string;
}): Promise<void> {
  try {
    await db.insert(notificationsTable).values({
      userId: params.userId,
      type: params.type,
      message: params.message,
    });
  } catch (err) {
    console.error("[NotificationService] Failed to create notification:", err);
  }
}

/**
 * Find the user ID linked to a candidate by email.
 * Returns null if no user found (e.g., guest applicant).
 */
export async function getUserIdByEmail(email: string): Promise<number | null> {
  const [user] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.email, email));
  return user?.id ?? null;
}

/**
 * Find all HR Officers in a given agency.
 */
export async function getHrOfficerIds(agencyId: number): Promise<number[]> {
  const { rolesTable } = await import("@workspace/db/schema");
  const hrOfficers = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .innerJoin(rolesTable, eq(usersTable.roleId, rolesTable.id))
    .where(and(eq(usersTable.agencyId, agencyId), eq(rolesTable.name, "hr_officer")));
  return hrOfficers.map((u) => u.id);
}

/**
 * Notify all HR Officers of an agency.
 */
export async function notifyHrOfficers(agencyId: number, type: string, message: string): Promise<void> {
  const hrOfficerIds = await getHrOfficerIds(agencyId);
  await Promise.all(hrOfficerIds.map((userId) => createNotification({ userId, type, message })));
}

/**
 * Find all admins, optionally scoped to an agency.
 */
export async function getAdminIds(agencyId?: number | null): Promise<number[]> {
  const { rolesTable } = await import("@workspace/db/schema");
  const query = db
    .select({ id: usersTable.id })
    .from(usersTable)
    .innerJoin(rolesTable, eq(usersTable.roleId, rolesTable.id));

  const conditions = [eq(rolesTable.name, "admin")];
  if (agencyId != null) conditions.push(eq(usersTable.agencyId, agencyId));

  const admins = await query.where(and(...conditions));
  return admins.map((u) => u.id);
}

/**
 * Notify all admins, optionally scoped to an agency.
 */
export async function notifyAdmins(agencyId: number | null | undefined, type: string, message: string): Promise<void> {
  const adminIds = await getAdminIds(agencyId);
  await Promise.all(adminIds.map((userId) => createNotification({ userId, type, message })));
}
