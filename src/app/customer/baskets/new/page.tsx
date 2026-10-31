import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/current";
import { catalogForBasket, supplierPriceList, suppliersInRegion } from "@/lib/customer/catalog";
import { customerForUser } from "@/lib/customer/quotes";
import { TEMPLATES } from "@/lib/customer/templates";
import { BasketBuilder, type BuilderRow } from "../basket-builder";

type Mode = "manual" | "supplier" | "template";

const today = () => new Date().toLocaleDateString("he-IL", { month: "long", year: "numeric" });

function ModeCard({ href, title, text, extra }: { href: string; title: string; text: string; extra?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-5">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="flex-1 text-sm text-muted">{text}</p>
      {extra ?? (
        <Link href={href} className="self-start rounded-md bg-accent px-4 py-2 text-sm font-medium text-white">
          בחירה
        </Link>
      )}
    </div>
  );
}

export default async function NewBasket({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; supplier?: string }>;
}) {
  const { mode: rawMode, supplier: supplierId } = await searchParams;
  const session = await requireRole("CUSTOMER");
  const customer = await customerForUser(session.userId);
  const mode = (["manual", "supplier", "template"] as const).find((m) => m === rawMode) as Mode | undefined;

  if (!mode) {
    return (
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-2xl font-bold">בדיקת מחירים חדשה</h1>
          <p className="text-sm text-muted">איך נתחיל? בכל דרך תוכלו לעדכן מוצרים וכמויות לפני ההשוואה.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <ModeCard
            href="/customer/invoices/new"
            title="יש לי חשבונית מהספק"
            text="מצלמים או מעלים חשבונית, ואנחנו קוראים ממנה את המוצרים, הכמויות והמחירים שאתם משלמים היום."
          />
          <ModeCard
            href="?mode=manual"
            title="יש לי רשימת מוצרים"
            text="בוחרים את המוצרים מהקטלוג ורושמים כמה אתם צורכים מכל אחד בחודש."
          />
          <ModeCard
            href="?mode=supplier"
            title="אני עובד היום עם ספק"
            text="בוחרים את הספק שלכם ואת המוצרים שאתם קונים ממנו, ואנחנו מוצאים לו מתחרים."
          />
          <ModeCard
            href="?mode=template"
            title="מסעדה חדשה"
            text={`בוחרים מוצרים בעצמכם, או מקבלים רשימה סטנדרטית ל${customer.cuisine} ומעדכנים אותה.`}
            extra={
              <div className="flex flex-wrap gap-2">
                <Link href="?mode=template" className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white">
                  רשימה סטנדרטית
                </Link>
                <Link href="?mode=manual" className="rounded-md border border-border px-4 py-2 text-sm hover:bg-background">
                  אבחר בעצמי
                </Link>
              </div>
            }
          />
        </div>
      </div>
    );
  }

  const back = (
    <Link href="/customer/baskets/new" className="text-sm text-muted hover:text-foreground">
      → דרך אחרת להתחיל
    </Link>
  );

  if (mode === "supplier" && !supplierId) {
    const suppliers = await suppliersInRegion(customer.regionId);
    return (
      <div className="flex flex-col gap-4">
        <div>
          {back}
          <h1 className="text-2xl font-bold">עם איזה ספק אתם עובדים היום?</h1>
          <p className="text-sm text-muted">ספקים שמספקים לאזור {customer.region.name}.</p>
        </div>
        {suppliers.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border bg-surface p-6 text-sm text-muted">
            עוד אין ספקים רשומים באזור שלכם. אפשר להתחיל מרשימת מוצרים.
          </p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {suppliers.map((s) => (
              <li key={s.id}>
                <Link
                  href={`?mode=supplier&supplier=${s.id}`}
                  className="flex flex-col gap-1 rounded-lg border border-border bg-surface p-4 hover:border-accent"
                >
                  <span className="font-medium">{s.companyName}</span>
                  <span className="text-sm text-muted">
                    {s._count.offers} מוצרים ·{" "}
                    {s.allCategories ? "כל התחומים" : s.categories.map((c) => c.category.name).join(", ")}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        <p className="text-sm text-muted">
          הספק שלכם לא ברשימה?{" "}
          <Link href="?mode=manual" className="text-accent">
            בנו את הרשימה בעצמכם
          </Link>{" "}
          ומלאו את המחיר שאתם משלמים היום.
        </p>
      </div>
    );
  }

  if (mode === "supplier") {
    const list = await supplierPriceList(supplierId!);
    if (!list) notFound();
    return (
      <div className="flex flex-col gap-4">
        <div>
          <Link href="?mode=supplier" className="text-sm text-muted hover:text-foreground">
            → בחירת ספק אחר
          </Link>
          <h1 className="text-2xl font-bold">מה אתם קונים מ{list.name}?</h1>
        </div>
        <div className="rounded-lg border border-border bg-surface p-5">
          <BasketBuilder
            source="CURRENT_SUPPLIER"
            currentSupplier={{ id: list.id, name: list.name }}
            catalog={list.items.map((i) => i.product)}
            initialRows={list.items.map((i) => ({
              productId: i.product.id,
              quantity: "",
              price: i.priceAgorot !== null ? (i.priceAgorot / 100).toFixed(2) : "",
              included: false,
            }))}
            initialName={`הסל מ${list.name.replace("ספק דמו: ", "")}`}
            initialDeliveries={4}
            initialVolume=""
            submitLabel="מציאת ספק מתחרה"
          />
        </div>
      </div>
    );
  }

  const catalog = await catalogForBasket();
  let rows: BuilderRow[] = [];
  if (mode === "template") {
    const byName = new Map(catalog.map((p) => [p.name, p]));
    rows = (TEMPLATES[customer.cuisine ?? ""] ?? TEMPLATES["אחר"])
      .filter(([name]) => byName.has(name))
      .map(([name, quantity]) => ({ productId: byName.get(name)!.id, quantity: String(quantity), price: "", included: true }));
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        {back}
        <h1 className="text-2xl font-bold">{mode === "template" ? `רשימה סטנדרטית ל${customer.cuisine}` : "רשימת המוצרים שלכם"}</h1>
        {mode === "template" && (
          <p className="text-sm text-muted">
            הכמויות מתאימות למסעדה קטנה-בינונית. עדכנו אותן לפי ההיקף שלכם, הורידו מה שלא צריך והוסיפו מוצרים.
          </p>
        )}
      </div>
      <div className="rounded-lg border border-border bg-surface p-5">
        <BasketBuilder
          source={mode === "template" ? "TEMPLATE" : "MANUAL"}
          catalog={catalog}
          initialRows={rows}
          initialName={`סל ${today()}`}
          initialDeliveries={4}
          initialVolume=""
          supplierNames={(await suppliersInRegion(customer.regionId)).map((s) => s.companyName)}
          submitLabel="השוואת מחירים"
        />
      </div>
    </div>
  );
}
