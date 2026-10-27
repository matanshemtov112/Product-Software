import Link from "next/link";

/** הצבע הצהוב הבולט של כפתורי "שליחת הודעה לספק"; טקסט שחור כדי שיהיה קריא גם במצב כהה */
export const SEND_TO_SUPPLIER_CLASS =
  "inline-flex items-center justify-center gap-2 rounded-md bg-[#ffd400] px-4 py-2 text-sm font-semibold text-black shadow-sm ring-1 ring-black/10 hover:bg-[#ffc400] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b38f00] disabled:opacity-60";

function Envelope() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect x="2.5" y="4.5" width="15" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M3 5.5l7 5.5 7-5.5" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

export function SendToSupplierLink({ href, label = "שליחת הודעה לספק" }: { href: string; label?: string }) {
  return (
    <Link href={href} className={SEND_TO_SUPPLIER_CLASS}>
      <Envelope />
      {label}
    </Link>
  );
}

export function SendToSupplierButton({ pending, label = "שליחת ההודעה לספק" }: { pending: boolean; label?: string }) {
  return (
    <button type="submit" disabled={pending} className={SEND_TO_SUPPLIER_CLASS}>
      <Envelope />
      {pending ? "שולח…" : label}
    </button>
  );
}
