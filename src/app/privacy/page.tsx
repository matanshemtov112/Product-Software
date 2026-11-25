import Link from "next/link";
import { Card } from "@/components/form";
import { MIN_BUSINESSES, WINDOW_DAYS } from "@/lib/supplier/demand";
import { INVOICE_RETENTION_DAYS as RETENTION_DAYS } from "@/lib/invoices/retention";

export const metadata = { title: "פרטיות ושימוש במידע" };

/** איך המערכת משתמשת במידע של עסקים וספקים. עובד בלי להתחבר */
export default function PrivacyPage() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <h1 className="text-2xl font-bold">פרטיות ושימוש במידע</h1>
      <Card>
        <h2 className="mb-2 font-semibold">מה ספקים רואים</h2>
        <ul className="flex list-disc flex-col gap-1.5 ps-5 text-sm">
          <li>ספק רואה את פרטי הקשר של עסק רק אחרי שהעסק קיבל את ההצעה שלו.</li>
          <li>ספקים לא רואים מחירים של ספקים מתחרים ולא את שמותיהם.</li>
          <li>בבקשה מהספק להשוות מחיר, העסק בוחר אם להראות את המחיר שמצא או רק תקרה.</li>
        </ul>
      </Card>
      <Card>
        <h2 className="mb-2 font-semibold">התעניינות במוצרים: סטטיסטיקה מצטברת לספקים</h2>
        <p className="text-sm">
          כשעסק משווה מחירים, בונה סל מחשבונית או מחפש מוצר בצילום, נרשם שהעסק התעניין במוצר. המידע משמש רק לסטטיסטיקה
          מצטברת לספקים, בלי פרטים מזהים: ספק רואה אילו מוצרים מבוקשים באזור החלוקה שלו ב-{WINDOW_DAYS} הימים האחרונים,
          רק כשלפחות {MIN_BUSINESSES} עסקים שונים התעניינו באותו מוצר, ותמיד כטווח ולא כמספר מדויק. לא נחשפים שם העסק,
          הכמויות, המחירים או פרטים מהחשבונית. עסק שחסם ספק לא נספר אצל אותו ספק.
        </p>
      </Card>
      <Card>
        <h2 className="mb-2 font-semibold">חשבוניות</h2>
        <p className="text-sm">
          קובץ החשבונית עצמו לא נשמר. השורות שנקראו ממנו נמחקות אוטומטית אחרי {RETENTION_DAYS} יום, ואפשר למחוק אותן
          קודם בדף ״היסטוריה״. שם הספק מהחשבונית לא נחשף לספקים אחרים.
        </p>
      </Card>
      <Card>
        <h2 className="mb-2 font-semibold">אימיילים</h2>
        <p className="text-sm">
          אימיילים שיווקיים נשלחים רק למי שהסכים לקבל אותם, ובכל אימייל יש קישור להסרה. אפשר לשנות את הבחירה בכל עת בדף
          ״הגדרות התראות״.
        </p>
      </Card>
      <Link href="/" className="text-sm text-accent hover:underline">
        חזרה לדף הבית
      </Link>
    </div>
  );
}
