import Link from "next/link";
import { getSession } from "@/lib/auth/current";
import { teamRoleOf } from "@/lib/auth/permission-check";
import { DENIED, type Permission, ROLE_LABEL } from "@/lib/auth/permissions";
import { Card } from "@/components/form";

export const dynamic = "force-dynamic";

const HOME = { CUSTOMER: "/customer", SUPPLIER: "/supplier", ADMIN: "/admin" } as const;

/** לכאן מגיעים כשעובד מנסה פעולה שהתפקיד שלו לא מרשה */
export default async function NoAccessPage({ searchParams }: { searchParams: Promise<{ need?: string }> }) {
  const { need } = await searchParams;
  const session = await getSession();
  const role = session ? await teamRoleOf(session.userId) : null;
  const reason = need && need in DENIED ? DENIED[need as Permission] : "התפקיד שלכם לא מאפשר את הפעולה הזו.";
  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4">
      <h1 className="text-2xl font-bold">אין הרשאה לפעולה הזו</h1>
      <Card>
        <p>{reason}</p>
        {role && <p className="mt-2 text-sm text-muted">התפקיד שלכם כרגע: {ROLE_LABEL[role]}.</p>}
        <p className="mt-2 text-sm text-muted">מנהל העסק יכול לשנות את התפקיד בדף ״משתמשים״.</p>
      </Card>
      <Link href={session ? HOME[session.role] : "/login"} className="text-accent hover:underline">
        חזרה לדף הבית
      </Link>
    </div>
  );
}
