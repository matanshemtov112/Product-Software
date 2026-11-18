import { requirePermission } from "@/lib/auth/permission-check";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/current";
import { catalogForBasket } from "@/lib/customer/catalog";
import { customerForUser } from "@/lib/customer/quotes";
import { db } from "@/lib/db";
import type { InvoiceLine } from "@/lib/invoices/read";
import { suggestProduct } from "@/lib/invoices/suggest";
import { InvoiceReview, type ReviewLine } from "./invoice-review";
import { ConfirmForm } from "@/components/confirm-form";
import { retentionEnd } from "@/lib/invoices/retention";
import { deleteInvoice } from "../../history/actions";

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireRole("CUSTOMER");
  await requirePermission("buy", session.userId);
  const customer = await customerForUser(session.userId);
  const invoice = await db.invoice.findFirst({ where: { id, customerId: customer.id } });
  if (!invoice) notFound();
  if (invoice.basketId && (await db.basket.findFirst({ where: { id: invoice.basketId, customerId: customer.id } })))
    redirect(`/customer/baskets/${invoice.basketId}`);

  const catalog = await catalogForBasket();
  const byName = new Map(catalog.map((p) => [p.name, p]));
  const fieldsOf = (p: (typeof catalog)[number]) => ({
    name: p.name,
    aliases: p.aliases,
    categories: [p.category, p.parentCategory].filter((c): c is string => Boolean(c)),
  });
  const lines: ReviewLine[] = (invoice.lines as unknown as InvoiceLine[]).map((l) => {
    const matched = l.productName ? byName.get(l.productName) : undefined;
    const suggested = matched ? undefined : suggestProduct(l.text, catalog, fieldsOf);
    return {
      text: l.text,
      productId: matched?.id ?? suggested?.id ?? "",
      suggested: Boolean(suggested),
      quantity: l.quantity !== null ? String(l.quantity) : "",
      price: l.unitPriceAgorot !== null ? (l.unitPriceAgorot / 100).toFixed(2) : "",
      confidence: suggested ? "low" : l.confidence,
      note: suggested ? "לא מצאנו התאמה בטוחה. בדקו שזה המוצר הנכון" : (l.note ?? null),
      included: Boolean(matched),
    };
  });
  const supplierNames = await db.supplier.findMany({
    where: { status: "APPROVED" },
    select: { companyName: true },
    orderBy: { companyName: "asc" },
  });

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link href="/customer/invoices/new" className="text-sm text-muted hover:text-foreground">
          → העלאת חשבונית אחרת
        </Link>
        <h1 className="text-2xl font-bold">בדיקת השורות מהחשבונית</h1>
        <p className="text-sm text-muted">
          קראנו {lines.length} שורות
          {invoice.invoiceDate ? ` מחשבונית מ-${new Date(invoice.invoiceDate).toLocaleDateString("he-IL")}` : ""}. בדקו
          את המוצר, הכמות והמחיר בכל שורה, במיוחד בשורות המסומנות בצהוב. המחירים ללא מע״מ.
        </p>
      </div>
      <InvoiceReview
        invoiceId={invoice.id}
        lines={lines}
        catalog={catalog.map((p) => ({ id: p.id, name: p.name, unit: p.unit, category: p.category }))}
        initialSupplierName={invoice.supplierName ?? ""}
        supplierNames={supplierNames.map((s) => s.companyName)}
      />
      <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
        <p className="text-muted">
          הקובץ עצמו לא נשמר. השורות שקראנו יימחקו אוטומטית ב-{retentionEnd(invoice.createdAt)}, או עכשיו אם תרצו.
        </p>
        <ConfirmForm
          needs="buy"
          action={deleteInvoice}
          fields={{ id: invoice.id, back: "/customer/invoices/new?deleted=1" }}
          confirm="למחוק את החשבונית עכשיו? השורות שקראנו יימחקו ואי אפשר לשחזר אותן."
          className="shrink-0 rounded-md border border-danger px-4 py-2 font-medium text-danger hover:bg-danger/5"
        >
          מחיקת החשבונית עכשיו
        </ConfirmForm>
      </div>
    </div>
  );
}
