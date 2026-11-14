import { STATUS_LABEL, type SupplierStatus } from "@/lib/customer/supplier-score";

const CLASS: Record<SupplierStatus, string> = {
  competitive: "bg-accent-soft text-accent",
  check: "bg-[#fff4c2] text-[#6b5300]",
  expensive: "bg-[#fbebeb] text-danger",
};

const DOT: Record<SupplierStatus, string> = { competitive: "🟢", check: "🟡", expensive: "🔴" };

export function SupplierStatusBadge({ status }: { status: SupplierStatus }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs whitespace-nowrap ${CLASS[status]}`}>
      <span aria-hidden="true">{DOT[status]}</span>
      {STATUS_LABEL[status]}
    </span>
  );
}
