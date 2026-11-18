import { cache } from "react";
import { redirect } from "next/navigation";
import type { TeamRole } from "@prisma/client";
import { db } from "@/lib/db";
import { getSession } from "./current";
import { DENIED, type Permission, roleCan } from "./permissions";

/** התפקיד העדכני של המשתמש בצוות (פעם אחת לכל בקשה, מהמסד ולא מהעוגייה) */
export const teamRoleOf = cache(async (userId: string): Promise<TeamRole | null> => {
  const user = await db.user.findUnique({ where: { id: userId }, select: { teamRole: true, role: true } });
  if (!user || user.role === "ADMIN") return null;
  return user.teamRole;
});

/** האם המשתמש המחובר רשאי לפעולה */
export async function can(permission: Permission, userId?: string) {
  const id = userId ?? (await getSession())?.userId;
  if (!id) return false;
  const role = await teamRoleOf(id);
  return role !== null && roleCan(role, permission);
}

/** לפעולות שמחזירות הודעה בטופס: ההסבר אם אין הרשאה, אחרת null */
export async function deniedMessage(permission: Permission, userId?: string) {
  return (await can(permission, userId)) ? null : DENIED[permission];
}

/** לפעולות בלי טופס: אם אין הרשאה, מעבר לדף שמסביר למה */
export async function requirePermission(permission: Permission, userId?: string) {
  if (!(await can(permission, userId))) redirect(`/no-access?need=${permission}`);
}
