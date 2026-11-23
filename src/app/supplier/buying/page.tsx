import { Card } from "@/components/form";
import { requireRole } from "@/lib/auth/current";
import { switchSide } from "@/lib/auth/actions";
import { isManager } from "@/lib/auth/team";
import { buyingAccountOf } from "@/lib/buying-account";
import { db } from "@/lib/db";
import { supplierForUser } from "@/lib/supplier/catalog";
import { OpenBuyingForm } from "./open-form";

export const metadata = { title: "קנייה מספקים" };

export default async function BuyingPage() {
  const session = await requireRole("SUPPLIER");
  const supplier = await supplierForUser(session.userId);
  const [account, manager, regions] = await Promise.all([
    buyingAccountOf(supplier.id),
    isManager(session.userId),
    db.region.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="flex max-w-2xl flex-col gap-5">
      <div>
        <h1 className="text-2xl font-bold">קנייה מספקים אחרים</h1>
        <p className="mt-1 text-sm text-muted">
          גם ספק קונה סחורה. למשל מפעל עוגיות שקונה קמח, או מפיץ שקונה אריזות. בחשבון הקנייה אתם עובדים בדיוק כמו מסעדה:
          בונים סל, משווים מחירים בין הספקים שמגיעים אליכם ושולחים פנייה. הספקים שמוכרים לכם רואים אתכם כלקוח רגיל.
        </p>
      </div>

      <Card title="מה נשאר סודי">
        <ul className="flex list-disc flex-col gap-1 ps-5 text-sm">
          <li>מוצרים שאתם עצמכם מוכרים לא מוצגים לכם במחירים של ספקים אחרים, כדי שאף ספק לא יראה מחירי מתחרים.</li>
          <li>אתם לא מופיעים לעצמכם בהשוואות.</li>
          <li>הספק שמוכר לכם מקבל את פרטי הקשר רק אחרי שקיבלתם את ההצעה שלו, כמו כל לקוח.</li>
        </ul>
      </Card>

      {account ? (
        <Card title="חשבון הקנייה שלכם">
          <p className="text-sm">
            {account.businessName} · {account.city} · {account.region.name}
          </p>
          <form action={switchSide} className="mt-3">
            <button className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90">
              מעבר לצד הקנייה
            </button>
          </form>
          <p className="mt-2 text-xs text-muted">
            אפשר לחזור לצד הספק בכל רגע, מהכפתור &quot;חזרה לצד הספק&quot; שבראש המסך.
          </p>
        </Card>
      ) : manager ? (
        <Card title="פתיחת חשבון קנייה">
          <OpenBuyingForm regions={regions} />
        </Card>
      ) : (
        <p className="rounded-lg border border-border bg-surface px-4 py-3 text-sm text-muted">
          רק מנהל הספק יכול לפתוח חשבון קנייה.
        </p>
      )}
    </div>
  );
}
