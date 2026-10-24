import { Card } from "@/components/form";
import { requireRole } from "@/lib/auth/current";
import { db } from "@/lib/db";
import { optimizeBasket, type Plan } from "@/lib/engine";
import { loadEngineInput } from "@/lib/engine/load";
import { shekels } from "@/lib/format";

export const dynamic = "force-dynamic";

const PREFERENCE_LABEL = { PRICE: "מחיר קודם", BALANCED: "מאוזן", SERVICE: "שירות קודם" } as const;

function PlanCard({ title, plan }: { title: string; plan: Plan | null }) {
  return (
    <Card title={title}>
      {plan ? (
        <div className="flex flex-col gap-2 text-sm">
          <p className="text-2xl font-bold">{shekels(plan.totalAgorot)}</p>
          <ul className="flex flex-col gap-1 text-muted">
            {plan.explanation.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-sm text-muted">אין ספקים מתאימים לסל הזה עדיין.</p>
      )}
    </Card>
  );
}

export default async function CustomerHome() {
  const session = await requireRole("CUSTOMER");
  const user = await db.user.findUniqueOrThrow({
    where: { id: session.userId },
    include: { customer: { include: { region: true, baskets: { orderBy: { createdAt: "asc" }, take: 1 } } } },
  });
  const customer = user.customer!;
  const basket = customer.baskets[0];
  const result = basket
    ? await loadEngineInput(basket.id).then(({ lines, suppliers, options }) => optimizeBasket(lines, suppliers, options))
    : null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">{customer.businessName}</h1>
        <p className="text-muted">
          {customer.businessType} · {customer.city} · {customer.region.name} · העדפה: {PREFERENCE_LABEL[customer.preference]}
        </p>
      </div>

      {!basket || !result ? (
        <Card title="הסל החודשי">
          <p className="text-sm text-muted">בניית סל תיפתח בשלב הבא. בינתיים אפשר לראות את חשבון הדמו.</p>
        </Card>
      ) : (
        <>
          {result.monthlySavingsAgorot !== null && result.monthlySavingsAgorot > 0 && (
            <div className="rounded-lg bg-accent-soft p-5">
              <p className="text-sm">חיסכון חודשי אפשרי</p>
              <p className="text-3xl font-bold text-accent">{shekels(result.monthlySavingsAgorot)}</p>
              <p className="text-sm text-muted">{shekels(result.annualSavingsAgorot!)} בשנה, מול העלות הנוכחית שלכם</p>
            </div>
          )}
          <h2 className="font-semibold">השוואה ל{basket.name}</h2>
          <div className="grid gap-4 md:grid-cols-3">
            <PlanCard title="המלצה" plan={result.recommended} />
            <PlanCard title="העלות הנמוכה ביותר" plan={result.lowestCost} />
            <PlanCard title="ספק יחיד" plan={result.singleSupplier} />
          </div>
          <p className="text-xs text-muted">כל המחירים ללא מע״מ. נבדקו {result.evaluatedCombinations} צירופי ספקים.</p>
        </>
      )}
    </div>
  );
}
