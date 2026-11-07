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
