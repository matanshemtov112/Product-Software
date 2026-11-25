import type { ReactNode } from "react";
import { shekels } from "@/lib/format";
import { dayText, type GuaranteeView } from "@/lib/guarantee-view";
import { dealNumber, isActive } from "@/lib/guarantees";

/** "המחיר מובטח עד…" או "ההבטחה הסתיימה ב…" */
export function GuaranteeBadge({ until }: { until: Date }) {
  const active = isActive({ guaranteedUntil: until });
  return active ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-good-soft px-3 py-1 text-sm font-medium text-good">
      🔒 המחיר מובטח עד {dayText(until)}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-sand px-3 py-1 text-sm text-muted">
      ההבטחה הסתיימה ב-{dayText(until)}
    </span>
  );
}

/** כפתור וואטסאפ: נפתח בלשונית חדשה עם הודעה מוכנה */
export function WhatsAppButton({ href, label = "המשך בוואטסאפ" }: { href: string; label?: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 rounded-full bg-[#1f7a4d] px-4 py-2 text-sm font-medium text-white hover:bg-[#17603c]"
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4 fill-current">
        <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3Z" />
      </svg>
      {label}
    </a>
  );
}

/** כותרת העסקה: מספר, מול מי, ותג ההבטחה */
export function GuaranteeHeader({ g, other, children }: { g: GuaranteeView; other: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-5 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex flex-col gap-2">
        <p className="text-sm text-muted">
          עסקה {dealNumber(g.number)} · אושרה ב-{dayText(g.acceptedAt)}
        </p>
        <h1 className="text-2xl font-bold">{other}</h1>
        <div>
          <GuaranteeBadge until={g.guaranteedUntil} />
        </div>
      </div>
      {children && <div className="flex flex-col items-start gap-2 sm:items-end">{children}</div>}
    </div>
  );
}

/** המחירים המובטחים; לכל שורה אפשר להוסיף פעולה (בקשת שינוי אצל הספק) */
export function GuaranteeLines({ g, action }: { g: GuaranteeView; action?: (lineId: string) => ReactNode }) {
  if (g.lines.length === 0) {
    return <p className="text-sm text-muted">{g.note ?? "אין מחירים ליחידה בעסקה הזו."}</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] text-sm">
        <thead className="text-xs text-muted">
          <tr className="border-b border-border">
            <th className="py-2 text-start font-medium">מוצר</th>
            <th className="py-2 text-start font-medium">כמות בחודש</th>
            <th className="py-2 text-start font-medium">מחיר מובטח, ללא מע״מ</th>
            {action && <th className="py-2" />}
          </tr>
        </thead>
        <tbody>
          {g.lines.map((l) => (
            <tr key={l.id} className="border-b border-border align-top last:border-0">
              <td className="py-2">
                <span className="font-medium">{l.productName}</span>
                {l.packLabel && <span className="block text-xs text-muted">{l.packLabel}</span>}
              </td>
              <td className="py-2">
                {l.monthlyQuantity
                  ? `${l.monthlyQuantity.toLocaleString("he-IL", { maximumFractionDigits: 1 })} ${l.unitLabel}`
                  : "—"}
              </td>
              <td className="py-2">
                <b>{shekels(l.unitPriceAgorot, 2)}</b> / {l.unitLabel}
                {l.version > 1 && <span className="block text-xs text-muted">עודכן אחרי אישור של הלקוח</span>}
              </td>
              {action && <td className="py-2 text-end">{action(l.id)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
      {g.note && <p className="mt-2 text-sm text-muted">{g.note}</p>}
    </div>
  );
}

const CHANGE_STATUS = {
  PENDING: "ממתין לאישור הלקוח",
  APPROVED: "אושר",
  DECLINED: "נדחה, המחיר נשאר",
  WITHDRAWN: "הספק ביטל את הבקשה",
} as const;

/** היסטוריית בקשות השינוי (בלי הממתינות, שמוצגות עם כפתורים) */
export function ChangeHistory({ g }: { g: GuaranteeView }) {
  const done = g.changes.filter((c) => c.status !== "PENDING");
  if (done.length === 0) return null;
  return (
    <ul className="flex flex-col gap-1 text-sm">
      {done.map((c) => (
        <li key={c.id}>
          <span className="text-muted">{dayText(c.createdAt)} · </span>
          {c.line.productName}: {shekels(c.oldAgorot, 2)} ← {shekels(c.newAgorot, 2)} / {c.line.unitLabel}
          <span className="text-muted"> · {CHANGE_STATUS[c.status]}</span>
        </li>
      ))}
    </ul>
  );
}
