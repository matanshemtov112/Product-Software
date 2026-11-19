import { Card } from "@/components/form";
import { OfferFacts } from "@/components/offer-facts";
import type { Plan } from "@/lib/engine";
import { shekels } from "@/lib/format";

export function PlanCard({ title, plan }: { title: string; plan: Plan | null }) {
  return (
    <Card title={title}>
      {plan ? (
        <div className="flex flex-col gap-2 text-sm">
          <div>
            <p className="text-xs text-muted">מחיר כולל לחודש, ללא מע״מ</p>
            <p className="text-2xl font-bold">{shekels(plan.totalAgorot)}</p>
          </div>
          <ul className="flex flex-col gap-1 text-muted">
            {plan.explanation.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
          <div className="flex flex-col gap-2">
            {plan.suppliers.map((s) => (
              <OfferFacts
                key={s.supplierId}
                supplierId={s.supplierId}
                supplierName={plan.suppliers.length > 1 ? s.supplierName : undefined}
                totalAgorot={s.totalAgorot}
                lines={s.lines}
              />
            ))}
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted">אין ספקים מתאימים לסל הזה עדיין.</p>
      )}
    </Card>
  );
}
