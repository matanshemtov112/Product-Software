// תנאי תשלום ותנאי אספקה כפי שהלקוח רואה אותם

/** האפשרויות לתנאי תשלום ללקוח מסוים: 0 = מזומן / בעת האספקה, אחרת שוטף + ימים */
export const PAYMENT_TERM_OPTIONS = [0, 30, 45, 60, 90, 120];

export function paymentTermsLabel(days: number) {
  return days === 0 ? "מזומן / בעת האספקה" : `שוטף + ${days}`;
}

/** תנאי התשלום שהלקוח רואה לפני שיש לו הצעה אישית */
export function publicPaymentTerms(s: { paymentTermsDays: number; paymentTermsPerCustomer: boolean }) {
  return s.paymentTermsPerCustomer ? "נקבעים מול כל לקוח" : paymentTermsLabel(s.paymentTermsDays);
}

/** תנאי תשלום מהטופס: ריק = לא צוין */
export function parsePaymentTerms(value: FormDataEntryValue | null): number | null | undefined {
  if (value === null || value === "") return null;
  const n = Number(value);
  return PAYMENT_TERM_OPTIONS.includes(n) ? n : undefined;
}

export const WEEK_DAYS = ["א", "ב", "ג", "ד", "ה", "ו"] as const;

export interface AreaTerms {
  deliveryDays?: string | null;
  orderCutoff?: string | null;
  deliveryNote?: string | null;
}

/** ימי אספקה תקינים בסדר השבוע, למשל "א,ג,ה"; null כשלא נבחר יום */
export function normalizeDays(days: string[]): string | null {
  const set = new Set(days);
  const ordered = WEEK_DAYS.filter((d) => set.has(d));
  return ordered.length ? ordered.join(",") : null;
}

/** שעה תקינה hh:mm, או null */
export function normalizeCutoff(value: string | null | undefined): string | null {
  const m = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec((value ?? "").trim());
  return m ? `${m[1].padStart(2, "0")}:${m[2]}` : null;
}

/** תנאי האספקה של אזור במשפט אחד, או null כשלא מולאו */
export function areaTermsText(t: AreaTerms): string | null {
  const parts: string[] = [];
  if (t.deliveryDays) {
    const days = t.deliveryDays.split(",");
    parts.push(
      days.length === WEEK_DAYS.length
        ? "אספקה בכל יום א׳ עד ו׳"
        : `אספקה בימים ${days.map((d) => `${d}׳`).join(", ")}`,
    );
  }
  if (t.orderCutoff) parts.push(`הזמנה עד ${t.orderCutoff} מגיעה באספקה הבאה`);
  if (t.deliveryNote) parts.push(t.deliveryNote);
  return parts.length ? parts.join(". ") + (t.deliveryNote?.match(/[.!?]$/) ? "" : ".") : null;
}
