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
