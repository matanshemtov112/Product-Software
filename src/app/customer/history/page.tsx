import Link from "next/link";
import { ConfirmForm } from "@/components/confirm-form";
import { Card } from "@/components/form";
import { EndedOfferActions } from "@/components/ended-offer-actions";
import { OfferBadge } from "@/components/offer-badge";
import { newInquiryHref } from "@/lib/customer/offer-links";
import { requireRole } from "@/lib/auth/current";
import { customerForUser } from "@/lib/customer/quotes";
import { db } from "@/lib/db";
import { shekels } from "@/lib/format";
import { INVOICE_RETENTION_DAYS } from "@/lib/invoices/retention";
import { inquiryStage, matchStage, type OfferStage } from "@/lib/offer-status";
import {
  clearHistory,
  deleteAllInvoices,
  deleteBasketChecks,
  deleteCheck,
  deleteInvoice,
  unhideOffers,
} from "./actions";

const DAY = 86_400_000;
const ENDED: OfferStage[] = ["ACCEPTED", "REJECTED", "EXPIRED", "CANCELLED"];
const date = (d: Date) => d.toLocaleDateString("he-IL");
const BACK = "/customer/history";

export default async function HistoryPage({ searchParams }: { searchParams: Promise<{ deleted?: string }> }) {
  const { deleted } = await searchParams;
  const session = await requireRole("CUSTOMER");
  const customer = await customerForUser(session.userId);
  const now = new Date();
  const [baskets, invoices, inquiries, matches] = await Promise.all([
    db.basket.findMany({
      where: { customerId: customer.id },
      select: {
        id: true,
        name: true,
        runs: { select: { id: true, createdAt: true, bestCostAgorot: true }, orderBy: { createdAt: "desc" } },
      },
      orderBy: { createdAt: "asc" },
    }),
    db.invoice.findMany({ where: { customerId: customer.id }, orderBy: { createdAt: "desc" } }),
    db.negotiationRequest.findMany({
      where: { customerId: customer.id, customerDeletedAt: null },
      include: { supplier: { select: { companyName: true } } },
      orderBy: { createdAt: "desc" },
    }),
    db.matchRequest.findMany({
      where: { customerId: customer.id, customerDeletedAt: null },
      include: { supplier: { select: { companyName: true } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const checks = baskets.reduce((n, b) => n + b.runs.length, 0);
  const basketIds = new Set(baskets.map((b) => b.id));
  const offers = [
    ...inquiries.map((i) => ({
      id: i.id,
      kind: "inquiry" as const,
      supplier: i.supplier.companyName,
      what: "פנייה",
      stage: inquiryStage(i, now),
      hidden: i.customerHiddenAt !== null,
      createdAt: i.createdAt,
      href: `/customer/inquiries/${i.id}`,
      newHref: newInquiryHref({ kind: "inquiry", ...i }, basketIds),
    })),
    ...matches.map((m) => ({
      id: m.id,
      kind: "match" as const,
      supplier: m.supplier.companyName,
      what: "בקשת השוואה",
      stage: matchStage(m, now),
      hidden: m.customerHiddenAt !== null,
      createdAt: m.createdAt,
      href: `/customer/matches/${m.id}`,
      newHref: newInquiryHref({ kind: "match", supplierName: m.supplier.companyName }, basketIds),
    })),
  ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const ended = offers.filter((o) => !o.hidden && ENDED.includes(o.stage));
  const hiddenCount = offers.filter((o) => o.hidden).length;
  const openCount = offers.filter((o) => !o.hidden && !ENDED.includes(o.stage)).length;
  const nothing = checks === 0 && invoices.length === 0 && ended.length === 0;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold">היסטוריה</h1>
        <p className="text-sm text-muted">
          כל מה שנשמר מהשימוש שלכם במערכת. אפשר למחוק כל פריט בנפרד, או לנקות הכול בבת אחת. הסלים עצמם ופרטי העסק לא
          נמחקים כאן.
        </p>
      </div>

      {deleted && (
        <p role="status" className="rounded-md bg-accent-soft px-4 py-3 text-sm">
          בוצע.
        </p>
      )}

      <section className="rounded-lg border border-border bg-surface p-5">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {(
            [
              ["בדיקות מחירים שמורות", checks, "#checks"],
              ["חשבוניות", invoices.length, "#invoices"],
              ["פניות שהסתיימו", ended.length, "#offers"],
              ["פניות פתוחות", openCount, "/customer/inquiries"],
            ] as const
          ).map(([label, n, href]) => (
            <a key={label} href={href} className="rounded-lg bg-background p-3 hover:ring-1 hover:ring-accent">
              <p className="text-2xl font-bold">{n}</p>
              <p className="text-xs text-muted">{label}</p>
            </a>
          ))}
        </div>
        <div className="mt-4 flex flex-col gap-2 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted">
            ניקוי כל ההיסטוריה מוחק את כל החשבוניות ואת כל בדיקות המחירים, ומסתיר את כל הפניות שהסתיימו. אי אפשר לבטל את
            זה.
          </p>
          {!nothing && (
            <ConfirmForm
              action={clearHistory}
              fields={{ back: `${BACK}?deleted=1` }}
              confirm="לנקות את כל ההיסטוריה? החשבוניות ובדיקות המחירים יימחקו ואי אפשר לשחזר אותן."
              className="shrink-0 whitespace-nowrap rounded-md border border-danger px-4 py-2 text-sm font-medium text-danger hover:bg-danger/5"
            >
              ניקוי כל ההיסטוריה
            </ConfirmForm>
          )}
        </div>
      </section>

      <Card id="checks" title="בדיקות מחירים שמורות">
        <p className="mb-3 text-sm text-muted">
          בכל פעם שאתם שומרים את המחירים של סל, נשמרת בדיקה. הבדיקה האחרונה משמשת להשוואה &quot;מה השתנה&quot; בכניסה
          הבאה. אם תמחקו אותה, ההשוואה תהיה מול הבדיקה שלפניה.
        </p>
        {baskets.every((b) => b.runs.length === 0) ? (
          <p className="text-sm text-muted">אין בדיקות שמורות.</p>
        ) : (
          <div className="flex flex-col gap-4">
            {baskets
              .filter((b) => b.runs.length > 0)
              .map((b) => (
                <div key={b.id} className="rounded-lg border border-border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Link href={`/customer/baskets/${b.id}`} className="font-medium text-accent hover:underline">
                      {b.name}
                    </Link>
                    <ConfirmForm
                      action={deleteBasketChecks}
                      fields={{ basketId: b.id, back: `${BACK}?deleted=1` }}
                      confirm={`למחוק את כל ${b.runs.length} הבדיקות של "${b.name}"? הסל עצמו נשאר.`}
                    >
                      מחיקת כל הבדיקות ({b.runs.length})
                    </ConfirmForm>
                  </div>
                  <ul className="mt-2 divide-y divide-border text-sm">
                    {b.runs.map((r, i) => {
                      const prev = b.runs[i + 1];
                      const delta = prev ? r.bestCostAgorot - prev.bestCostAgorot : 0;
                      return (
                        <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                          <span>
                            {date(r.createdAt)}
                            {i === 0 && <span className="ms-2 text-xs text-muted">(האחרונה)</span>}
                          </span>
                          <span className="flex items-center gap-4">
                            <span>
                              הכי זול: <strong>{shekels(r.bestCostAgorot)}</strong>
                              {delta !== 0 && (
                                <span className={`ms-1 text-xs ${delta < 0 ? "text-accent" : "text-danger"}`}>
                                  ({delta < 0 ? "ירד" : "עלה"} ב-{shekels(Math.abs(delta))})
                                </span>
                              )}
                            </span>
                            <ConfirmForm
                              action={deleteCheck}
                              fields={{ id: r.id, back: `${BACK}?deleted=1` }}
                              confirm={`למחוק את הבדיקה מ-${date(r.createdAt)}?`}
                            >
                              מחיקה
                            </ConfirmForm>
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
          </div>
        )}
      </Card>

      <Card id="invoices" title="חשבוניות">
        <p className="mb-3 text-sm text-muted">
          קובץ החשבונית עצמו לא נשמר אף פעם. נשמרות רק השורות שקראנו ממנו, והן נמחקות אוטומטית אחרי{" "}
          {INVOICE_RETENTION_DAYS} יום. אפשר גם למחוק עכשיו. סל שנוצר מחשבונית לא נמחק איתה.
        </p>
        {invoices.length === 0 ? (
          <p className="text-sm text-muted">אין חשבוניות שמורות.</p>
        ) : (
          <>
            <ul className="divide-y divide-border text-sm">
              {invoices.map((inv) => {
                const left = Math.max(
                  0,
                  Math.ceil((inv.createdAt.getTime() + INVOICE_RETENTION_DAYS * DAY - now.getTime()) / DAY),
                );
                const lines = Array.isArray(inv.lines) ? inv.lines.length : 0;
                const basket = inv.basketId ? baskets.find((b) => b.id === inv.basketId) : undefined;
                return (
                  <li key={inv.id} className="flex flex-col gap-1 py-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="font-medium">
                        {inv.supplierName ?? "ספק לא ידוע"}
                        {inv.invoiceDate && (
                          <span className="font-normal text-muted">
                            {" "}
                            · חשבונית מ-{new Date(inv.invoiceDate).toLocaleDateString("he-IL")}
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-muted">
                        הועלתה {date(inv.createdAt)} · {lines} שורות · תימחק אוטומטית בעוד {left} ימים
                        {basket ? (
                          <>
                            {" "}
                            · נוצר ממנה הסל{" "}
                            <Link href={`/customer/baskets/${basket.id}`} className="text-accent hover:underline">
                              {basket.name}
                            </Link>
                          </>
                        ) : (
                          <>
                            {" "}
                            ·{" "}
                            <Link href={`/customer/invoices/${inv.id}`} className="text-accent hover:underline">
                              להמשך בדיקת השורות
                            </Link>
                          </>
                        )}
                      </p>
                    </div>
                    <ConfirmForm
                      action={deleteInvoice}
                      fields={{ id: inv.id, back: `${BACK}?deleted=1` }}
                      confirm="למחוק את החשבונית עכשיו? אי אפשר לשחזר אותה."
                    >
                      מחיקה עכשיו
                    </ConfirmForm>
                  </li>
                );
              })}
            </ul>
            {invoices.length > 1 && (
              <div className="mt-3">
                <ConfirmForm
                  action={deleteAllInvoices}
                  fields={{ back: `${BACK}?deleted=1` }}
                  confirm={`למחוק את כל ${invoices.length} החשבוניות עכשיו?`}
                >
                  מחיקת כל החשבוניות ({invoices.length})
                </ConfirmForm>
              </div>
            )}
          </>
        )}
      </Card>

      <Card id="offers" title="פניות שהסתיימו">
        <p className="mb-3 text-sm text-muted">
          פניות ובקשות השוואה שהתקבלו, נדחו, בוטלו או שהתוקף שלהן עבר. ליד כל אחת: פנייה חדשה לאותו ספק עם המחירים של
          היום, הסתרה מהרשימה (אפשר להחזיר), או מחיקה מהרשימה (לצמיתות). אצל הספק הפנייה נשארת, כי גם הוא צד לה.
        </p>
        {ended.length === 0 ? (
          <p className="text-sm text-muted">אין פניות שהסתיימו.</p>
        ) : (
          <ul className="divide-y divide-border text-sm">
            {ended.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <Link href={o.href} className="flex flex-wrap items-center gap-2 hover:underline">
                  <span className="font-medium">{o.supplier}</span>
                  <OfferBadge stage={o.stage} />
                  <span className="text-muted">
                    {o.what} · {date(o.createdAt)}
                  </span>
                </Link>
                <EndedOfferActions
                  id={o.id}
                  kind={o.kind}
                  supplierName={o.supplier}
                  newHref={o.newHref}
                  back={`${BACK}?deleted=1`}
                />
              </li>
            ))}
          </ul>
        )}
        {hiddenCount > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted">
            <span>{hiddenCount} פניות מוסתרות.</span>
            <ConfirmForm
              action={unhideOffers}
              fields={{ back: BACK }}
              confirm="להחזיר את כל הפניות המוסתרות לרשימה?"
              className="text-sm text-accent hover:underline"
            >
              החזרה לרשימה
            </ConfirmForm>
          </div>
        )}
      </Card>
    </div>
  );
}
