import Link from "next/link";
import { redirect } from "next/navigation";
import { Card } from "@/components/form";
import { getSession } from "@/lib/auth/current";
import { logoutEverywhere } from "@/lib/auth/password-actions";
import { HOME_BY_ROLE } from "@/lib/auth/session";
import { decryptSecret, totpSetup } from "@/lib/auth/two-factor";
import { startTotpSetup } from "@/lib/auth/two-factor-actions";
import { db } from "@/lib/db";
import { shortDate } from "@/lib/price-status";
import { ChangePasswordForm, TwoFactorPanel } from "./forms";

export const metadata = { title: "אבטחת החשבון" };

export default async function SecurityPage({
  searchParams,
}: {
  searchParams: Promise<{ setup?: string; required?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { setup, required } = await searchParams;
  const user = await db.user.findUniqueOrThrow({ where: { id: session.userId } });
  const pendingSecret = setup && user.totpPendingSecret ? decryptSecret(user.totpPendingSecret) : null;
  const qr = pendingSecret && !user.totpEnabledAt ? await totpSetup(pendingSecret, user.email) : null;
  const logins = await db.auditLog.findMany({
    where: { userId: user.id, action: { in: ["login.success", "login.failed", "login.blocked"] } },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: { action: true, createdAt: true, ip: true },
  });

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <div>
        <Link href={HOME_BY_ROLE[session.role]} className="text-sm text-accent">
          → חזרה
        </Link>
        <h1 className="mt-1 text-2xl font-bold">אבטחת החשבון</h1>
        <p className="text-sm text-muted">{user.email}</p>
      </div>

      {required && !user.totpEnabledAt && (
        <p role="alert" className="rounded-md border border-danger px-4 py-3 text-sm">
          לחשבון מנהל מערכת חובה להפעיל אימות דו-שלבי לפני שממשיכים.
        </p>
      )}

      <Card title="אימות דו-שלבי">
        <TwoFactorPanel
          enabledSince={user.totpEnabledAt ? shortDate(user.totpEnabledAt) : null}
          recoveryLeft={user.recoveryCodes.length}
          setup={qr}
          isAdmin={user.role === "ADMIN"}
          startAction={startTotpSetup}
        />
      </Card>

      <Card title="שינוי סיסמה">
        <ChangePasswordForm />
      </Card>

      <Card title="כניסות אחרונות">
        <ul className="flex flex-col gap-1 text-sm">
          {logins.map((l, i) => (
            <li key={i} className="flex justify-between gap-3">
              <span>
                {l.action === "login.success" ? "כניסה" : l.action === "login.failed" ? "סיסמה שגויה" : "נחסם"}
              </span>
              <span className="text-muted" dir="ltr">
                {l.createdAt.toLocaleString("he-IL", { timeZone: "Asia/Jerusalem" })} · {l.ip ?? "?"}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-muted">משהו לא מוכר? החליפו סיסמה וצאו מכל המכשירים.</p>
      </Card>

      <Card title="יציאה מכל המכשירים">
        <p className="text-sm">מנתק את החשבון בכל טלפון ומחשב, כולל מחשב משותף ששכחתם בו את החשבון מחובר.</p>
        <form action={logoutEverywhere} className="mt-3">
          <button className="rounded-full border border-border px-4 py-2 text-sm hover:bg-background">
            יציאה מכל המכשירים
          </button>
        </form>
      </Card>
    </div>
  );
}
