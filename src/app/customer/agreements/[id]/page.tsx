import Link from "next/link";
import { notFound } from "next/navigation";
import { ChangeHistory, GuaranteeHeader, GuaranteeLines, WhatsAppButton } from "@/components/guarantee";
import { Card } from "@/components/form";
import { requireRole } from "@/lib/auth/current";
import { customerForUser } from "@/lib/customer/quotes";
import { shekels } from "@/lib/format";
import { dayText, isoDayText, loadGuarantee, whatsappFor } from "@/lib/guarantee-view";
import { GUARANTEE_DAYS, isActive } from "@/lib/guarantees";
import { decideGuaranteeChange } from "../actions";

export default async function CustomerAgreement({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireRole("CUSTOMER");
  const customer = await customerForUser(session.userId);
  const g = await loadGuarantee(id, { customerId: customer.id });
  if (!g) notFound();
  const whatsapp = whatsappFor(g, "CUSTOMER");
  const pending = g.changes.filter((c) => c.status === "PENDING");
  const source = g.inquiry
    ? { href: `/customer/inquiries/${g.inquiry.id}`, label: "הפנייה המקורית" }
    : g.matchRequest
      ? { href: `/customer/matches/${g.matchRequest.id}`, label: "בקשת ההשוואה המקורית" }
      : null;
  return (
    <div className="flex flex-col gap-4">
      <Link href="/customer/agreements" className="text-sm text-accent hover:underline">
        → כל המחירים המובטחים
      </Link>
      <GuaranteeHeader g={g} other={g.supplier.companyName}>
        {whatsapp && <WhatsAppButton href={whatsapp} />}
        {source && (
          <Link href={source.href} className="text-sm text-accent hover:underline">
            {source.label}
          </Link>
        )}
      </GuaranteeHeader>

      {g.breaches.length > 0 && (
        <section className="rounded-lg border border-danger bg-surface p-5" role="alert">
          <h2 className="font-semibold text-danger">הספק חייב יותר מהמחיר המובטח</h2>
          <ul className="mt-2 flex flex-col gap-1 text-sm">
            {g.breaches.map((b) => (
              <li key={b.id}>
                {b.line.productName}: הובטח {shekels(b.guaranteedAgorot, 2)}, בחשבונית
                {b.invoiceDate ? ` מ-${isoDayText(b.invoiceDate)}` : ""} {shekels(b.chargedAgorot, 2)} ל{b.line.unitLabel}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-sm text-muted">
            צוות הפלטפורמה קיבל עדכון. כדאי לפנות לספק עם מספר העסקה, ואם הוא לא מתקן, לדווח על הפרת מחיר.
          </p>
          <Link
            href={
              g.inquiry
                ? `/customer/inquiries/${g.inquiry.id}`
                : `/customer/suppliers/${encodeURIComponent(g.supplier.companyName)}`
            }
            className="mt-2 inline-block text-sm text-accent hover:underline"
          >
            דיווח על הפרת מחיר
          </Link>
        </section>
      )}

      {pending.length > 0 && (
        <Card title="הספק מבקש לשנות מחיר">
          <ul className="flex flex-col gap-3">
            {pending.map((c) => (
              <li
                key={c.id}
                className="flex flex-col gap-2 rounded-2xl bg-sand p-3 text-sm sm:flex-row sm:items-center sm:justify-between"
              >
                <span>
                  <b>{c.line.productName}</b>: {shekels(c.oldAgorot, 2)} ← <b>{shekels(c.newAgorot, 2)}</b> /{" "}
                  {c.line.unitLabel}
                  {c.reason && <span className="block text-muted">הסיבה: {c.reason}</span>}
                </span>
                <form action={decideGuaranteeChange} className="flex gap-2" data-needs="buy">
                  <input type="hidden" name="changeId" value={c.id} />
                  <button name="decision" value="APPROVED" className="rounded-full bg-accent px-4 py-1.5 text-white">
                    לאשר
                  </button>
                  <button
                    name="decision"
                    value="DECLINED"
                    className="rounded-full border border-border bg-surface px-4 py-1.5"
                  >
                    לא לאשר
                  </button>
                </form>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted">בלי האישור שלכם המחיר המובטח לא משתנה.</p>
        </Card>
      )}

      <Card title="המחירים המובטחים">
        <GuaranteeLines g={g} />
        <p className="mt-3 text-xs text-muted">
          {isActive(g)
            ? `המחירים האלה חלים על כל ההזמנות שלכם מהספק עד ${dayText(g.guaranteedUntil)} (${GUARANTEE_DAYS} יום מהאישור). כשתעלו חשבונית מהספק, נבדוק אותה מולם.`
            : "תקופת ההבטחה הסתיימה. המחירים כאן נשמרים לתיעוד."}
        </p>
        {!whatsapp && isActive(g) && (
          <p className="mt-2 text-xs text-muted">הספק לא עובד בוואטסאפ. אפשר ליצור קשר בטלפון שמופיע בפנייה.</p>
        )}
      </Card>

      {g.changes.some((c) => c.status !== "PENDING") && (
        <Card title="שינויים קודמים">
          <ChangeHistory g={g} />
        </Card>
      )}
    </div>
  );
}
