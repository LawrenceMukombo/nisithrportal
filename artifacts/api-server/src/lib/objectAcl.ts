import { File } from "@google-cloud/storage";

const ACL_POLICY_METADATA_KEY = "custom:aclPolicy";

/**
 * ACL policy stored as GCS custom metadata on each object.
 * owner: the agency ID (as string) that owns this document.
 * visibility: "private" restricts to the owning agency; "public" allows any authenticated user.
 */
export interface ObjectAclPolicy {
  owner: string;
  visibility: "public" | "private";
}

export async function setObjectAclPolicy(
  objectFile: File,
  aclPolicy: ObjectAclPolicy,
): Promise<void> {
  const [exists] = await objectFile.exists();
  if (!exists) {
    throw new Error(`Object not found: ${objectFile.name}`);
  }
  await objectFile.setMetadata({
    metadata: {
      [ACL_POLICY_METADATA_KEY]: JSON.stringify(aclPolicy),
    },
  });
}

export async function getObjectAclPolicy(
  objectFile: File,
): Promise<ObjectAclPolicy | null> {
  const [metadata] = await objectFile.getMetadata();
  const raw = metadata?.metadata?.[ACL_POLICY_METADATA_KEY];
  if (!raw) return null;
  return JSON.parse(raw as string);
}

/**
 * Check whether a user (identified by agencyId) may read an object.
 * - agencyId === null: system-level user — access granted unconditionally.
 *   This is intentional: callers of this function must already have been
 *   authenticated and role-checked (e.g. requireRole middleware). Only users
 *   with admin/system roles should have agencyId === null in this application.
 * - Non-null agencyId: must match the ACL owner field exactly.
 * - No policy set: access denied (fail-secure).
 */
export async function canAccessObjectForAgency(
  objectFile: File,
  agencyId: number | null,
): Promise<boolean> {
  if (agencyId === null) return true;
  const policy = await getObjectAclPolicy(objectFile);
  if (!policy) return false;
  return policy.owner === String(agencyId);
}
