import Link from "next/link";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/current";
import { SupplierStatusBadge } from "@/components/supplier-status";
import { mySuppliers } from "@/lib/customer/my-suppliers";
import { customerForUser } from "@/lib/customer/quotes";
import { matchCandidates, matchSummary } from "@/lib/matches";
import { db } from "@/lib/db";
import { shekels } from "@/lib/format";

const date = (d: Date) => d.toLocaleDateString("he-IL");
const DAY = 86_400_000;

interface Alert {
  href: string;
  text: string;
  action: string;
  tone: "accent" | "warn" | "muted";
}

function Stat({ label, value, note, highlight }: { label: string; value: string; note?: string; highlight?: boolean }) {
  return (
    <div className={`rounded-lg p-4 ${highlight ? "bg-accent-soft" : "border border-border bg-surface"}`}>
      <p className="text-sm text-muted">{label}</p>
      <p className={`text-2xl font-bold ${highlight ? "text-accent" : ""}`}>{value}</p>
      {note && <p className="text-xs text-muted">{note}</p>}
    </div>
  );
}

export default async function CustomerHome() {
  const session = await requireRole("CUSTOMER");
  const customer = await customerForUser(session.userId);
  const baskets = await db.basket.findMany({
    where: { customerId: customer.id },
    include: {
      _count: { select: { items: true } },
      currentSupplier: { select: { companyName: true } },
      runs: { orderBy: { createdAt: "desc" }, take: 1 },
    },
    orderBy: [{ savedAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
  });
  // לקוח חדש מתחיל ישר בבניית סל
  if (baskets.length === 0) redirect("/customer/baskets/new");

  const [suppliers, answeredMatches, replies] = await Promise.all([
    mySuppliers(customer.id),
    db.matchRequest.findMany({
      where: { customerId: customer.id, status: "ANSWERED" },
      include: { supplier: { select: { companyName: true } }, lines: true },
    }),
    db.negotiationRequest.findMany({
      where: { customerId: customer.id, status: "OFFERED", repliedAt: { gte: new Date(Date.now() - 14 * DAY) } },
      include: { supplier: { select: { companyName: true } } },
      orderBy: { repliedAt: "desc" },
    }),
  ]);
  const products = suppliers.reduce((n, s) => n + s.lines.length, 0);
  const opportunities = suppliers.reduce((n, s) => n + s.lines.filter((l) => l.monthlySavingAgorot > 0).length, 0);
  const saving = suppliers.reduce((n, s) => n + s.score.monthlySavingAgorot, 0);

  const alerts: Alert[] = [];
  for (const m of answeredMatches) {
    const pending = matchSummary(m.lines).awaitingDecision;
    if (pending)
      alerts.push({
        href: `/customer/matches/${m.id}`,
        text: `${m.supplier.companyName} הציע מחיר חדש ל-${pending} מוצרים`,
        action: "לאשר או לדחות",
        tone: "accent",
      });
  }
  for (const r of replies)
    alerts.push({
      href: "/customer/inquiries",
      text: `${r.supplier.companyName} השיב לפנייה שלכם`,
      action: "לקריאה",
      tone: "accent",
    });
  for (const s of suppliers)
    if (s.score.status === "expensive" && matchCandidates(s.lines).length)
      alerts.push({
        href: `/customer/suppliers/${encodeURIComponent(s.key)}`,
        text: `${s.name} יקר יחסית: אפשר לחסוך עד ${shekels(s.score.monthlySavingAgorot)} בחודש`,
        action: "לפרטים",
        tone: "warn",
      });
  for (const b of baskets) {
    const last = b.runs[0]?.createdAt ?? b.savedAt;
    if (b.savedAt && last && Date.now() - last.getTime() > 30 * DAY)
      alerts.push({
        href: `/customer/baskets/${b.id}`,
        text: `עבר חודש מהבדיקה האחרונה של "${b.name}"`,
        action: "לבדוק שוב",
        tone: "muted",
      });
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold">שלום, {customer.businessName}</h1>
        <p className="text-sm text-muted">תמונת מצב של הרכש שלכם, לפי המחירים שמילאתם ומהחשבוניות. המחירים ללא מע״מ.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="מוצרים במעקב" value={String(products)} note="עם מחיר שאתם משלמים היום" />
        <Stat label="הספקים שלי" value={String(suppliers.length)} />
        <Stat label="הזדמנויות" value={String(opportunities)} note="מוצרים שיש להם מחיר זול יותר" />
        <Stat label="חיסכון אפשרי" value={shekels(saving)} note={`בחודש · ${shekels(saving * 12)} בשנה`} highlight />
      </div>

      <div className="grid gap-4 md:grid-cols-[2fr_1fr]">
        <section className="rounded-lg border border-border bg-surface p-4">
          <h2 className="mb-2 font-semibold">מה דורש תשומת לב</h2>
          {alerts.length === 0 ? (
            <p className="text-sm text-muted">אין כרגע משהו שמחכה לכם.</p>
          ) : (
            <ul className="divide-y divide-border">
              {alerts.map((a) => (
                <li key={a.href + a.text}>
                  <Link
                    href={a.href}
                    className="flex items-center justify-between gap-3 py-2.5 text-sm hover:text-accent"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span
                        aria-hidden="true"
                        className={`size-2 shrink-0 rounded-full ${
                          a.tone === "accent" ? "bg-accent" : a.tone === "warn" ? "bg-[#e0a800]" : "bg-border"
                        }`}
                      />
                      {a.text}
                    </span>
                    <span className="shrink-0 text-accent">{a.action} ←</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4">
          <h2 className="mb-1 font-semibold">פעולות מהירות</h2>
          <Link
            href="/customer/invoices/new"
            className="rounded-md bg-accent px-4 py-2 text-center text-sm font-medium text-white"
          >
            העלאת חשבונית
          </Link>
          <Link href="/customer/baskets/new" className="rounded-md border border-border px-4 py-2 text-center text-sm">
            בדיקת מחירים חדשה
          </Link>
          <Link href="/customer/suppliers" className="rounded-md border border-border px-4 py-2 text-center text-sm">
            הספקים שלי
          </Link>
        </section>
      </div>

      {suppliers.length > 0 && (
        <section className="rounded-lg border border-border bg-surface p-4">
          <h2 className="mb-2 font-semibold">הספקים שלי</h2>
          <ul className="divide-y divide-border">
            {suppliers.map((s) => (
              <li key={s.key}>
                <Link
                  href={`/customer/suppliers/${encodeURIComponent(s.key)}`}
                  className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm hover:text-accent"
                >
                  <span className="flex items-center gap-2">
                    <span className="font-medium">{s.name}</span>
                    <SupplierStatusBadge status={s.score.status} />
                  </span>
                  <span className="text-muted">
                    {s.lines.length} מוצרים · ציון {s.score.score}/100
                    {s.score.monthlySavingAgorot > 0 ? ` · חיסכון ${shekels(s.score.monthlySavingAgorot)} בחודש` : ""}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">הבדיקות שלי</h2>
          <p className="text-sm text-muted">סלים שבדקתם. סל שמור אפשר לבדוק שוב כל חודש ולראות מה השתנה.</p>
        </div>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2">
        {baskets.map((b) => (
          <li key={b.id}>
            <Link
              href={`/customer/baskets/${b.id}`}
              className="flex h-full flex-col gap-1 rounded-lg border border-border bg-surface p-4 hover:border-accent"
            >
              <span className="flex items-center justify-between gap-2">
                <span className="font-medium">{b.name}</span>
                <span
                  className={`rounded px-2 py-0.5 text-xs ${b.savedAt ? "bg-accent-soft text-accent" : "bg-background text-muted"}`}
                >
                  {b.savedAt ? "שמור" : "לא נשמר"}
                </span>
              </span>
              <span className="text-sm text-muted">
                {b._count.items} מוצרים
                {b.currentSupplier ? ` · ספק נוכחי: ${b.currentSupplier.companyName}` : ""}
              </span>
              <span className="text-sm text-muted">
                {b.runs[0]
                  ? `בדיקה אחרונה ${date(b.runs[0].createdAt)}: הכי זול ${shekels(b.runs[0].bestCostAgorot)}`
                  : `נוצר ${date(b.createdAt)}`}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
