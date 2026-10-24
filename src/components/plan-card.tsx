import { Card } from "@/components/form";
import type { Plan } from "@/lib/engine";
import { shekels } from "@/lib/format";

export function PlanCard({ title, plan }: { title: string; plan: Plan | null }) {
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
