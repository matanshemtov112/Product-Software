import Link from "next/link";
import { notFound } from "next/navigation";
import { ChangeHistory, GuaranteeHeader, GuaranteeLines, WhatsAppButton } from "@/components/guarantee";
import { Card } from "@/components/form";
import { requireRole } from "@/lib/auth/current";
import { shekels } from "@/lib/format";
import { dayText, loadGuarantee, whatsappFor } from "@/lib/guarantee-view";
import { GUARANTEE_DAYS, isActive } from "@/lib/guarantees";
import { supplierForUser } from "@/lib/supplier/catalog";
import { withdrawGuaranteeChange } from "../actions";
import { ChangeRequest } from "./change-form";

export default async function SupplierAgreement({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireRole("SUPPLIER");
  const supplier = await supplierForUser(session.userId);
  const g = await loadGuarantee(id, { supplierId: supplier.id });
  if (!g) notFound();
  const active = isActive(g);
  const whatsapp = whatsappFor(g, "SUPPLIER");
  const pending = g.changes.filter((c) => c.status === "PENDING");
  const pendingLines = new Set(pending.map((c) => c.lineId));
  const source = g.inquiry
    ? { href: `/supplier/inquiries/${g.inquiry.id}`, label: "הפנייה המקורית ופרטי הקשר" }
    : g.matchRequest
      ? { href: `/supplier/matches/${g.matchRequest.id}`, label: "בקשת ההשוואה המקורית ופרטי הקשר" }
      : null;
  return (
    <div className="flex flex-col gap-4">
      <Link href="/supplier/agreements" className="text-sm text-accent hover:underline">
        → כל העסקאות
      </Link>
      <GuaranteeHeader g={g} other={`${g.customer.businessName} · ${g.customer.city}`}>
        {whatsapp && <WhatsAppButton href={whatsapp} />}
        {!whatsapp && active && !supplier.whatsappEnabled && (
          <Link href="/supplier/profile#whatsapp" className="text-xs text-muted hover:underline">
            וואטסאפ כבוי אצלכם · להפעלה
          </Link>
        )}
        {source && (
          <Link href={source.href} className="text-sm text-accent hover:underline">
            {source.label}
          </Link>
        )}
      </GuaranteeHeader>

      {pending.length > 0 && (
        <Card title="ממתין לאישור הלקוח">
          <ul className="flex flex-col gap-2 text-sm">
            {pending.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-sand p-3">
                <span>
                  {c.line.productName}: {shekels(c.oldAgorot, 2)} ← <b>{shekels(c.newAgorot, 2)}</b> /{" "}
                  {c.line.unitLabel}
                </span>
                <form action={withdrawGuaranteeChange} data-needs="prices">
                  <input type="hidden" name="changeId" value={c.id} />
                  <button className="text-xs text-accent hover:underline">ביטול הבקשה</button>
                </form>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card title="המחירים שהבטחתם">
        <GuaranteeLines
          g={g}
          action={
            active
              ? (lineId) => {
                  const line = g.lines.find((l) => l.id === lineId)!;
                  return pendingLines.has(lineId) ? (
                    <span className="text-xs text-muted">ממתין ללקוח</span>
                  ) : (
                    <ChangeRequest lineId={lineId} unitLabel={line.unitLabel} />
                  );
                }
              : undefined
          }
        />
        <p className="mt-3 text-xs text-muted">
          {active
            ? `המחירים האלה מחייבים אתכם מול הלקוח בכל ההזמנות עד ${dayText(g.guaranteedUntil)} (${GUARANTEE_DAYS} יום מהאישור), גם אם תשנו את המחירון. הלקוח יכול להעלות חשבונית, והמערכת בודקת אותה מול המחירים האלה.`
            : "תקופת ההבטחה הסתיימה. המחירים כאן נשמרים לתיעוד."}
        </p>
      </Card>

      {g.changes.some((c) => c.status !== "PENDING") && (
        <Card title="שינויים קודמים">
          <ChangeHistory g={g} />
        </Card>
      )}
    </div>
  );
}
