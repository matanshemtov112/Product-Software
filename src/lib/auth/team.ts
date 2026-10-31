import { db } from "@/lib/db";
import { getSession } from "./current";

/** הארגון של המשתמש המחובר (עסק או ספק) וכל מה שצריך לניהול הצוות */
export async function currentMember() {
  const session = await getSession();
  if (!session || (session.role !== "CUSTOMER" && session.role !== "SUPPLIER")) return null;
  const user = await db.user.findUnique({ where: { id: session.userId } });
  if (!user) return null;
  const org = user.customerId
    ? { customerId: user.customerId }
    : user.supplierId
      ? { supplierId: user.supplierId }
      : null;
  if (!org) return null;
  return { user, org, role: session.role };
}

export async function teamMembers(org: { customerId: string } | { supplierId: string }) {
  return db.user.findMany({
    where: org,
    select: { id: true, name: true, email: true, phone: true, isManager: true, createdAt: true },
    orderBy: [{ isManager: "desc" }, { createdAt: "asc" }],
  });
}

/** האם המשתמש המחובר הוא מנהל העסק או הספק */
export async function isManager(userId: string) {
  const user = await db.user.findUnique({ where: { id: userId }, select: { isManager: true } });
  return Boolean(user?.isManager);
}
