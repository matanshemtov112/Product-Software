import Link from "next/link";
import { Card } from "@/components/form";
import { emailConfigured } from "@/lib/email";
import { CATEGORIES, CATEGORY_LABEL, EMAIL_OPTIONS, FREQUENCY_LABEL, effectivePref } from "@/lib/notify/categories";
import { savedPrefs } from "@/lib/notify/prefs";
import { PrefsForm } from "./prefs-form";

/** הגדרות ההתראות של המשתמש המחובר, משותף למסעדה ולספק */
export async function NotificationSettings({
  userId,
  email,
  org,
  children,
}: {
  userId: string;
  email: string;
  org: "CUSTOMER" | "SUPPLIER";
  children?: React.ReactNode;
}) {
  const saved = await savedPrefs(userId);
  const area = org === "CUSTOMER" ? "/customer" : "/supplier";
  const rows = CATEGORIES.map((c) => {
    const pref = effectivePref(
      c,
      saved.find((s) => s.category === c),
    );
    return {
      category: c,
      ...CATEGORY_LABEL[org][c],
      locked: c === "CRITICAL",
      inApp: pref.inApp,
      email: pref.email,
      options: EMAIL_OPTIONS[c].map((o) => ({ value: o, label: FREQUENCY_LABEL[o] })),
    };
  });
  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link href={`${area}/notifications`} className="text-sm text-muted hover:text-foreground">
          → חזרה להתראות
        </Link>
        <h1 className="text-2xl font-bold">הגדרות התראות</h1>
        <p className="text-sm text-muted">
          כל אחד בצוות בוחר לעצמו. האימיילים נשלחים ל-<span dir="ltr">{email}</span>. הזדמנויות לחיסכון מרוכזות בהודעה
          אחת ולא הודעה לכל מוצר.
        </p>
      </div>
      {!emailConfigured() && (
        <p className="rounded-md border border-border bg-accent-soft px-4 py-3 text-sm">
          שליחת האימיילים עוד לא הופעלה במערכת. ההגדרות נשמרות, והאימיילים יתחילו לצאת כשהשירות יחובר.
        </p>
      )}
      <Card>
        <PrefsForm rows={rows} />
      </Card>
      {children}
    </div>
  );
}
