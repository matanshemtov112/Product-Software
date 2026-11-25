import Link from "next/link";
import { Card } from "@/components/form";
import { db } from "@/lib/db";
import { CATEGORY_LABEL } from "@/lib/notify/categories";
import { readUnsubscribeToken } from "@/lib/notify/unsubscribe";
import { confirmUnsubscribe } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "הסרה מרשימת התפוצה", robots: { index: false } };

/** דף ההסרה שהקישור בכל אימייל מוביל אליו. עובד בלי להתחבר */
export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string; done?: string }>;
}) {
  const { t, done } = await searchParams;
  const parsed = t ? readUnsubscribeToken(t) : null;
  const user = parsed
    ? await db.user.findUnique({ where: { id: parsed.userId }, select: { email: true, role: true } })
    : null;
  if (!parsed || !user) {
    return (
      <div className="mx-auto flex max-w-lg flex-col gap-4">
        <h1 className="text-2xl font-bold">הקישור לא תקין</h1>
        <Card>
          <p>אולי הקישור נחתך בהעתקה. אפשר להתחבר ולשנות את ההגדרות בדף ״הגדרות התראות״.</p>
        </Card>
        <Link href="/login" className="text-accent hover:underline">
          כניסה למערכת
        </Link>
      </div>
    );
  }
  const org = user.role === "SUPPLIER" ? "SUPPLIER" : "CUSTOMER";
  const label = CATEGORY_LABEL[org][parsed.category].title;
  const marketing = parsed.category === "MARKETING";
  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4">
      <h1 className="text-2xl font-bold">הסרה מרשימת התפוצה</h1>
      <Card>
        {done ? (
          <p role="status">
            הוסרתם. לא יישלחו יותר אימיילים של ״{label}״ ל-<span dir="ltr">{user.email}</span>.
            {marketing && " ההסכמה לקבל פרסומות בוטלה."}
          </p>
        ) : (
          <form action={confirmUnsubscribe} className="flex flex-col gap-3">
            <input type="hidden" name="t" value={t} />
            <p>
              להפסיק לשלוח אימיילים של ״{label}״ ל-<span dir="ltr">{user.email}</span>?
            </p>
            <p className="text-sm text-muted">ההתראות ימשיכו להופיע בתוך המערכת. הודעות חשובות ימשיכו להישלח.</p>
            <div>
              <button className="rounded-full bg-accent px-4 py-2 font-medium text-white">הסירו אותי</button>
            </div>
          </form>
        )}
      </Card>
      <p className="text-sm text-muted">
        אפשר לשנות כל הגדרה אחרת אחרי{" "}
        <Link href="/login" className="text-accent hover:underline">
          כניסה למערכת
        </Link>
        , בדף ״הגדרות התראות״.
      </p>
    </div>
  );
}
