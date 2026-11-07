import { dealLabel, dealStatus } from "@/lib/deal-label";
import { shekels } from "@/lib/format";
import type { QuantityDealInput } from "@/lib/engine/quantity-deal";
import { priceStatus, type PriceStatusKey } from "@/lib/price-status";

const STATUS_CLASS: Record<PriceStatusKey, string> = {
  fixed: "bg-accent-soft text-accent",
  until: "bg-[#e7f1fb] text-[#1f4f82]",
  promotion: "bg-[#fff4c2] text-[#6b5300]",
};

/** סוג המחיר (קבוע / עם תוקף / מבצע) ומתי עודכן, ליד המחיר */
export function PriceStatusBadge({
  kind,
  updatedAt,
  validTo,
}: {
  kind?: string;
  updatedAt?: string | Date | null;
  validTo?: string | Date | null;
}) {
  const status = priceStatus({ kind, updatedAt, validTo });
  return (
    <span title={status.detail} className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
      <span className={`rounded px-1.5 py-0.5 text-xs whitespace-nowrap ${STATUS_CLASS[status.key]}`}>
        {status.label}
      </span>
      {status.updated && (
        <span className={`text-xs whitespace-nowrap ${status.stale ? "text-danger" : "text-muted"}`}>
          {status.updated}
        </span>
      )}
    </span>
  );
}

/** מבצע כמות ליד המחיר, ומה חסר כדי לקבל אותו */
export function DealBadge({
  deal,
  unitLabel,
}: {
  deal: QuantityDealInput & { applied?: boolean; missingPerOrder?: number };
  unitLabel: string;
}) {
  return (
    <span className="flex flex-col gap-0.5 text-xs">
      <span className="w-fit rounded bg-[#fde7d9] px-1.5 py-0.5 text-[#7a3410]">{dealLabel(deal, unitLabel)}</span>
      {deal.applied !== undefined && (
        <span className={deal.applied ? "text-accent" : "text-muted"}>
          {dealStatus({ applied: deal.applied, missingPerOrder: deal.missingPerOrder ?? 0 }, unitLabel)}
        </span>
      )}
    </span>
  );
}

/** "מבצע!" קטן באדום, בצד ימין של שם המוצר */
export function SaleMark() {
  return <span className="me-1.5 align-middle text-xs font-bold text-danger">מבצע!</span>;
}

/**
 * מחיר אמיתי גבוה יותר עם קו, ליד המחיר: המחיר הרגיל של הספק בזמן מבצע,
 * או המחיר שהלקוח משלם היום כשההצעה זולה ממנו. אף פעם לא מחיר "מקורי" מומצא.
 */
export function WasPrice({
  nowAgorot,
  regularAgorot,
  paidAgorot,
}: {
  nowAgorot: number;
  regularAgorot?: number | null;
  paidAgorot?: number | null;
}) {
  if (regularAgorot != null && regularAgorot > nowAgorot) {
    return (
      <span className="me-1.5 text-xs text-muted">
        <span className="line-through">{shekels(regularAgorot, 2)}</span> מחיר רגיל
      </span>
    );
  }
  if (paidAgorot != null && paidAgorot > nowAgorot) {
    return (
      <span className="me-1.5 text-xs text-muted">
        <span className="line-through">{shekels(paidAgorot, 2)}</span> אתם משלמים היום
      </span>
    );
  }
  return null;
}
